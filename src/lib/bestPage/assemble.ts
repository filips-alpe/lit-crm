/**
 * The best page: one page for any record, composed from whatever data the
 * record has. Nothing here knows about a particular type or entity — the
 * sections come from the type's layout and from the record's relations, and
 * a section with no data is left out.
 *
 * Pure and isomorphic: the server load builds the input, the page renders the
 * output, and both sides of a client navigation see the same structure.
 */
import type { LayoutField } from '$lib/forms/layout';

/** A stretch of a record's text, linked to an entity when it names one. */
export type TextSegment = { text: string; entityId?: string; entityTitle?: string };

export type MentionSpan = { start: number; end: number; entityId: string; entityTitle?: string };

/**
 * Splits `text` at the mention spans. The segments concatenate back to `text`
 * exactly, so linking never changes the displayed wording. Spans out of
 * range, empty, or overlapping an earlier span are ignored.
 */
export function segmentText(text: string, mentions: MentionSpan[]): TextSegment[] {
  const spans = [...mentions]
    .filter((m) => m.start >= 0 && m.end <= text.length && m.start < m.end)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: TextSegment[] = [];
  let at = 0;
  for (const m of spans) {
    if (m.start < at) continue;
    if (m.start > at) out.push({ text: text.slice(at, m.start) });
    out.push({
      text: text.slice(m.start, m.end),
      entityId: m.entityId,
      entityTitle: m.entityTitle,
    });
    at = m.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/** The words around a mention: `before` + `match` + `after`, trimmed to whole words. */
export type MentionContext = { before: string; match: string; after: string };

/**
 * Cuts a context around [start, end) of `text`, where `text` may itself be a
 * slice of the record's text beginning at `offset` (so the database can send
 * only the neighbourhood of each mention).
 */
export function mentionContext(
  text: string,
  start: number,
  end: number,
  offset = 0,
  radius = 110,
): MentionContext {
  const s = start - offset;
  const e = end - offset;
  let before = text.slice(Math.max(0, s - radius), s);
  let after = text.slice(e, e + radius);
  if (s - radius > 0) before = '…' + before.replace(/^\S*\s/, '');
  if (e + radius < text.length) after = after.replace(/\s\S*$/, '') + '…';
  const flat = (x: string) => x.replace(/\s+/g, ' ');
  return { before: flat(before), match: flat(text.slice(s, e)), after: flat(after) };
}

export type RecordRef = {
  id: string;
  title: string | null;
  typeCode: string;
  typeColor: string;
  date?: string | null;
};

export type FactValue =
  | { kind: 'text'; value: string }
  | { kind: 'date'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'list'; value: string[] }
  | { kind: 'person'; value: string }
  | { kind: 'record'; value: RecordRef };

export type Fact = { label: string; value: FactValue };

export type MentionGroup = { source: RecordRef; count: number; contexts: MentionContext[] };

export type RelatedEntity = RecordRef & { count: number };

export type BestPageSection =
  | { kind: 'facts'; facts: Fact[] }
  /** `label` is the layout field's own label; null when the type has no text field (the page supplies a translated default). */
  | { kind: 'text'; label: string | null; segments: TextSegment[] }
  | { kind: 'mentions'; total: number; groups: MentionGroup[]; more: number }
  | { kind: 'mentioned'; entities: RelatedEntity[] }
  | { kind: 'related'; entities: RelatedEntity[] }
  | { kind: 'linked'; parent: RecordRef | null; children: RecordRef[] }
  | { kind: 'sources'; references: string[] };

export type BestPage = {
  record: RecordRef & { description?: string | null; typeIconSeed: string | null };
  sections: BestPageSection[];
};

/** Everything the assembler reads; the server load fills it from the database. */
export type BestPageInput = {
  record: {
    id: string;
    title: string | null;
    description?: string | null;
    text?: string | null;
    references?: string[] | null;
    date?: Date | string | null;
    creator?: { name: string } | null;
    assignee?: { name: string } | null;
    record?: RecordRef | null;
    [column: string]: unknown;
  };
  type: {
    code: string;
    color: string;
    iconSeed?: string | null;
    layout: { fields: LayoutField[] };
  };
  /** Mentions inside this record's text. */
  outgoing: MentionSpan[];
  /** The records those mentions name. */
  named: RecordRef[];
  /** Mentions of this record in other records, with their neighbourhood of text. */
  incoming: { source: RecordRef; start: number; end: number; slice: string; sliceStart: number }[];
  /** Total incoming mentions (the list may be capped). */
  incomingTotal: number;
  /** Entities that share source records with this one, with the shared count. */
  related: RelatedEntity[];
  children: RecordRef[];
  /** At most this many source groups and contexts per group are shown. */
  limits?: { groups: number; contexts: number };
};

const isoDay = (v: Date | string) =>
  (v instanceof Date ? v : new Date(v)).toISOString().slice(0, 10);

function factFor(field: LayoutField, input: BestPageInput): FactValue | null {
  const r = input.record;
  const raw = r[field.writeTo];
  switch (field.kind) {
    case 'text':
    case 'markdown':
    case 'location':
      return typeof raw === 'string' && raw.trim() ? { kind: 'text', value: raw } : null;
    case 'date':
    case 'datetime':
      return raw instanceof Date || (typeof raw === 'string' && raw)
        ? { kind: 'date', value: isoDay(raw as Date | string) }
        : null;
    case 'number':
      return typeof raw === 'number' ? { kind: 'number', value: raw } : null;
    case 'list':
      return Array.isArray(raw) && raw.length ? { kind: 'list', value: raw.map(String) } : null;
    case 'user': {
      const person = field.writeTo === 'creatorId' ? r.creator : r.assignee;
      return person ? { kind: 'person', value: person.name } : null;
    }
    case 'record':
      return r.record ? { kind: 'record', value: r.record } : null;
  }
}

export function buildBestPage(input: BestPageInput): BestPage {
  const { record, type } = input;
  const limits = input.limits ?? { groups: 40, contexts: 3 };
  const sections: BestPageSection[] = [];
  const fields = type.layout.fields;

  // The body is the first text-column field; the title and sources have their
  // own places on the page. Everything else with a value is a fact.
  const body = fields.find((f) => f.writeTo === 'text');
  const facts: Fact[] = [];
  for (const f of fields) {
    if (f === body || f.writeTo === 'title' || f.writeTo === 'references') continue;
    if (f.kind === 'record') continue; // shown under "linked"
    const value = factFor(f, input);
    if (value) facts.push({ label: f.label, value });
  }
  if (facts.length) sections.push({ kind: 'facts', facts });

  const text = typeof record.text === 'string' ? record.text : '';
  if (text.trim()) {
    sections.push({
      kind: 'text',
      label: body?.label ?? null,
      segments: segmentText(text, input.outgoing),
    });
  }

  // Entities this record's text names, most often first.
  const named = new Map<string, RelatedEntity>();
  for (const m of input.outgoing) {
    const cur = named.get(m.entityId);
    if (cur) cur.count++;
    else {
      const ref = input.named.find((r) => r.id === m.entityId);
      if (ref) named.set(m.entityId, { ...ref, count: 1 });
    }
  }
  if (named.size) {
    const entities = [...named.values()].sort(
      (a, b) => b.count - a.count || (a.title ?? '').localeCompare(b.title ?? ''),
    );
    sections.push({ kind: 'mentioned', entities });
  }

  if (input.incoming.length) {
    const groups = new Map<string, MentionGroup>();
    for (const m of input.incoming) {
      const g = groups.get(m.source.id) ?? { source: m.source, count: 0, contexts: [] };
      g.count++;
      if (g.contexts.length < limits.contexts) {
        g.contexts.push(mentionContext(m.slice, m.start, m.end, m.sliceStart));
      }
      groups.set(m.source.id, g);
    }
    const sorted = [...groups.values()].sort(
      (a, b) => b.count - a.count || (a.source.date ?? '').localeCompare(b.source.date ?? ''),
    );
    sections.push({
      kind: 'mentions',
      total: input.incomingTotal,
      groups: sorted.slice(0, limits.groups),
      more: Math.max(0, sorted.length - limits.groups),
    });
  }

  // Entities mentioned alongside this one, in the records that mention it.
  const related = input.related.filter((r) => r.id !== record.id);
  if (related.length) sections.push({ kind: 'related', entities: related });

  if (record.record || input.children.length) {
    sections.push({ kind: 'linked', parent: record.record ?? null, children: input.children });
  }

  const references = (record.references ?? []).filter((r) => r.trim());
  if (references.length) sections.push({ kind: 'sources', references });

  return {
    record: {
      id: record.id,
      title: record.title,
      description: record.description,
      typeCode: type.code,
      typeColor: type.color,
      typeIconSeed: type.iconSeed ?? null,
      date: record.date ? isoDay(record.date) : null,
    },
    sections,
  };
}
