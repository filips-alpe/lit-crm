import type { FieldKind, FormLayout, LayoutField } from './layout';
import { columnsForKind, KINDS_IN_FALLBACK_ORDER, type FieldSuggestion } from './builder';
import { humanizeIdentifier } from '$lib/utils/humanize';
import * as m from '$lib/paraglide/messages.js';

export interface TypeContext {
  typeCode?: string | null;
  typeDescription?: string | null;
}

const KINDS: readonly FieldKind[] = ['text', 'number', 'date', 'datetime', 'list', 'location'];
const MAX_SUGGESTIONS = 6;

export async function isPromptApiAvailable(): Promise<boolean> {
  if (typeof globalThis.LanguageModel === 'undefined') return false;
  try {
    const status = await globalThis.LanguageModel.availability();
    // Not 'downloadable': creating a session would start a model download from
    // what is only a typing side effect.
    return status === 'available';
  } catch {
    return false;
  }
}

function freeColumnsByKind(layout: FormLayout): Record<FieldKind, string[]> {
  const taken = new Set(layout.fields.map((f) => f.writeTo));
  return Object.fromEntries(
    KINDS.map((kind) => [kind, columnsForKind(kind).filter((c) => !taken.has(c))]),
  ) as Record<FieldKind, string[]>;
}

function normalizeLabel(s: string): string {
  return s.trim().toLowerCase();
}

// Suffix a label until it is unique against both `seenLabel` (labels already
// emitted in this stream) and `blockedLabels` (labels on existing fields).
// Falls back to the humanized column name when the candidate is empty.
function uniquifyLabel(
  candidate: string,
  writeTo: string,
  seenLabel: Set<string>,
  blockedLabels: Set<string>,
): string {
  const base = candidate.trim() || humanizeIdentifier(writeTo);
  const taken = (s: string) => {
    const key = normalizeLabel(s);
    return seenLabel.has(key) || blockedLabels.has(key);
  };
  if (!taken(base)) return base;
  for (let n = 2; ; n++) {
    const next = `${base} ${n}`;
    if (!taken(next)) return next;
  }
}

// Dedupe by `writeTo` only — every free column must surface. Label collisions
// (against existing-field labels or earlier entries in the stream) are
// resolved by suffixing rather than dropping the entry, so the panel never
// loses a column. FormBuilder's duplicate-label indicator flags any forced
// rename so the user can adjust inline.
function dedupe(list: FieldSuggestion[], blockedLabels: Set<string>): FieldSuggestion[] {
  const seenWriteTo = new Set<string>();
  const seenLabel = new Set<string>();
  const out: FieldSuggestion[] = [];
  for (const s of list) {
    if (seenWriteTo.has(s.writeTo)) continue;
    const label = uniquifyLabel(s.label, s.writeTo, seenLabel, blockedLabels);
    seenWriteTo.add(s.writeTo);
    seenLabel.add(normalizeLabel(label));
    out.push({ ...s, label });
  }
  return out;
}

function validate(raw: unknown, free: Record<FieldKind, string[]>): FieldSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as { label?: unknown; kind?: unknown; writeTo?: unknown };
    if (typeof r.label !== 'string' || !r.label.trim()) continue;
    if (typeof r.kind !== 'string' || !KINDS.includes(r.kind as FieldKind)) continue;
    const kind = r.kind as FieldKind;
    if (typeof r.writeTo !== 'string' || !free[kind].includes(r.writeTo)) continue;
    out.push({ label: r.label.trim().slice(0, 40), kind, writeTo: r.writeTo });
  }
  return out;
}

function buildSchema(free: Record<FieldKind, string[]>) {
  const allFree = KINDS.flatMap((k) => free[k]);
  return {
    type: 'array',
    minItems: allFree.length,
    maxItems: allFree.length,
    items: {
      type: 'object',
      required: ['label', 'kind', 'writeTo'],
      additionalProperties: false,
      properties: {
        label: { type: 'string', minLength: 1, maxLength: 40 },
        kind: { type: 'string', enum: [...KINDS] },
        writeTo: { type: 'string', enum: allFree },
      },
    },
  };
}

function buildSystemPrompt(free: Record<FieldKind, string[]>): string {
  const catalog = KINDS.map((k) => {
    if (free[k].length === 0) return `  ${k}: (none free)`;
    const cols = free[k].map((c) => `${c} (default: "${humanizeIdentifier(c)}")`).join(', ');
    return `  ${k}: ${cols}`;
  }).join('\n');
  return [
    'You design generic record forms. Given a type code, description, and the',
    'existing fields, return ONE entry per free column from the catalog below,',
    'ranked best-first (writeTo columns are unique — never reuse one). Each',
    "column's default humanized label is shown in parentheses:",
    catalog,
    'You may only choose the ORDER and the human LABEL for each field — never',
    'invent kinds or columns. Tailor labels and ranking to the type code,',
    'description, and existing fields so suggestions feel cohesive and avoid',
    "duplicating what's already there.",
    'LABEL UNIQUENESS (case-insensitive, applies across both axes):',
    '  1. Every label must be distinct from every label in the "Used labels" list.',
    '  2. Every label must be distinct from every OTHER label in your own response.',
    "If a column's default label would collide with either, INVENT a contextually",
    'distinct alternative for it — never drop the field, never repeat a label.',
    'Respond with JSON only. Labels short (1-3 words), human-readable, contextual.',
  ].join('\n');
}

function describeExistingFields(fields: LayoutField[]): string {
  if (fields.length === 0) return '(none)';
  return fields.map((f) => `${f.label || '(unlabeled)'} [${f.kind}/${f.writeTo}]`).join(', ');
}

function buildUserPrompt(layout: FormLayout, context: TypeContext): string {
  const lines: string[] = [];
  if (context.typeCode?.trim()) lines.push(`Type code: "${context.typeCode.trim()}".`);
  if (context.typeDescription?.trim()) {
    lines.push(`Type description: "${context.typeDescription.trim()}".`);
  }
  lines.push(`Existing fields: ${describeExistingFields(layout.fields)}.`);
  const usedLabels = layout.fields.map((f) => f.label?.trim()).filter((s): s is string => !!s);
  lines.push(
    `Used labels (do not reuse, case-insensitive): ${
      usedLabels.length ? usedLabels.map((l) => `"${l}"`).join(', ') : '(none)'
    }.`,
  );
  lines.push('Propose the most useful next fields as JSON.');
  return lines.join('\n');
}

async function suggestViaPromptApi(
  layout: FormLayout,
  free: Record<FieldKind, string[]>,
  context: TypeContext,
  signal?: AbortSignal,
): Promise<FieldSuggestion[]> {
  const model = globalThis.LanguageModel;
  if (!model) return [];
  const session = await model.create({
    temperature: 0.4,
    topK: 3,
    initialPrompts: [{ role: 'system', content: buildSystemPrompt(free) }],
    signal,
  });
  try {
    const reply = await session.prompt(buildUserPrompt(layout, context), {
      responseConstraint: buildSchema(free),
      signal,
    });
    return validate(JSON.parse(reply), free);
  } finally {
    session.destroy();
  }
}

// Keyword-based fallback when the in-browser model is unavailable.
// Each rule lists candidate suggestions in priority order; the first whose
// writeTo is still free wins.
const HEURISTIC_RULES: { match: RegExp; candidates: () => FieldSuggestion[] }[] = [
  {
    match: /\b(money|price|cost|amount|fee|charge|total|invoice|bill|payment)/i,
    candidates: () => [
      { label: m.full_plane_gecko_list(), kind: 'number', writeTo: 'total' },
      { label: m.lofty_patient_jackal_agree(), kind: 'text', writeTo: 'text' },
      { label: m.tired_quaint_florian_buzz(), kind: 'number', writeTo: 'sum' },
    ],
  },
  {
    match: /\b(schedule|date|when|day|deadline)/i,
    candidates: () => [
      { label: m.this_mushy_raven_skip(), kind: 'date', writeTo: 'date' },
      { label: m.due_each_jay_laugh(), kind: 'date', writeTo: 'start' },
      { label: m.ornate_knotty_squid_hope(), kind: 'date', writeTo: 'end' },
    ],
  },
  {
    match: /\b(time|hours?|duration)\b/i,
    candidates: () => [
      { label: m.funny_nice_larva_explore(), kind: 'number', writeTo: 'hours' },
      { label: m.antsy_white_stork_accept(), kind: 'text', writeTo: 'note' },
    ],
  },
  {
    match: /\b(note|comment|description|detail)/i,
    candidates: () => [
      { label: m.yummy_shy_parrot_borrow(), kind: 'text', writeTo: 'note' },
      { label: m.this_quaint_pig_startle(), kind: 'text', writeTo: 'title' },
      { label: m.noble_tame_falcon_read(), kind: 'text', writeTo: 'description' },
    ],
  },
  {
    match: /\b(place|location|address|trip|travel|route)/i,
    candidates: () => [
      { label: m.alert_elegant_racoon_revive(), kind: 'text', writeTo: 'from' },
      { label: m.real_ornate_newt_vent(), kind: 'text', writeTo: 'to' },
      { label: m.next_left_wallaby_create(), kind: 'location', writeTo: 'fromGeo' },
      { label: m.spry_key_puffin_ripple(), kind: 'location', writeTo: 'toGeo' },
    ],
  },
  {
    match: /\b(tags?|ids?|references?|links?)\b/i,
    candidates: () => [{ label: m.quick_odd_osprey_sail(), kind: 'list', writeTo: 'references' }],
  },
  {
    match: /\b(book|reservation|booking)/i,
    candidates: () => [
      { label: m.sleek_close_badger_push(), kind: 'text', writeTo: 'text' },
      { label: m.lime_noisy_elephant_sail(), kind: 'date', writeTo: 'date' },
    ],
  },
];

function suggestHeuristic(keywords: string, free: Record<FieldKind, string[]>): FieldSuggestion[] {
  const out: FieldSuggestion[] = [];
  // Type codes are often snake_case, which \b would read as one word.
  const words = keywords.replace(/[_-]+/g, ' ');
  for (const rule of HEURISTIC_RULES) {
    if (!rule.match.test(words)) continue;
    for (const c of rule.candidates()) {
      if (free[c.kind].includes(c.writeTo)) out.push(c);
    }
  }
  return out;
}

// Default-pad: emit every free column with its humanized name as the label.
function defaultSuggestions(free: Record<FieldKind, string[]>): FieldSuggestion[] {
  const out: FieldSuggestion[] = [];
  for (const kind of KINDS_IN_FALLBACK_ORDER) {
    for (const writeTo of free[kind]) {
      out.push({ label: humanizeIdentifier(writeTo), kind, writeTo });
    }
  }
  return out;
}

export async function suggestFields(
  layout: FormLayout,
  context: TypeContext = {},
  signal?: AbortSignal,
): Promise<FieldSuggestion[]> {
  const free = freeColumnsByKind(layout);
  // Nothing left to suggest — every column is already mapped to a field.
  if (!KINDS.some((k) => free[k].length > 0)) return [];

  const existingLabels = new Set(
    layout.fields.map((f) => normalizeLabel(f.label)).filter((s) => s.length > 0),
  );

  const keywords = [context.typeCode, context.typeDescription]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join(' ')
    .trim();

  let aiSuggestions: FieldSuggestion[] = [];
  if (await isPromptApiAvailable()) {
    try {
      aiSuggestions = await suggestViaPromptApi(layout, free, context, signal);
    } catch {
      aiSuggestions = [];
    }
  }
  const heuristicSuggestions =
    aiSuggestions.length === 0 && keywords ? suggestHeuristic(keywords, free) : [];

  // Pad with humanized column names so every free column surfaces — the model
  // and heuristics get first pick of ranking and contextual labels; dedupe
  // resolves label collisions by suffixing rather than dropping, so no column
  // is ever silently lost.
  return dedupe(
    [...aiSuggestions, ...heuristicSuggestions, ...defaultSuggestions(free)],
    existingLabels,
  ).slice(0, MAX_SUGGESTIONS);
}
