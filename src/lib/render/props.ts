import type { SuperForm } from 'sveltekit-superforms';
import type { FieldKind, FormLayout } from '$lib/forms/layout';
import { formatFieldValue, type FormattedFieldValue } from '$lib/forms/format';
import type { MentionSpan } from '$lib/records/mentionSegments';

/** A relation field's resolved target: the linked entity's id + a display label,
 *  plus a person's color/avatar for `user` relations (absent for `record`). */
export interface RendererRelation {
  id: string;
  label: string;
  color?: string;
  avatarSeed?: string | null;
}

/**
 * The prop contract handed to a per-type renderer. Authors can read the type's
 * configured fields (keyed by stable field id) plus a fixed allowlist of
 * non-form fields — never arbitrary record columns.
 */
export interface RendererFieldValue {
  label: string;
  kind: FieldKind;
  /** Physical record column this field writes to — lets renderers target a
   *  field by its semantic column (e.g. `sum`, `from`) without per-type config. */
  writeTo: string;
  /** Display-formatted value (see formatFieldValue); null when empty. */
  value: FormattedFieldValue;
  /** Raw column value, untouched. */
  raw: unknown;
  /** For `user`/`record` relation fields: the resolved target (or null when the
   *  joined entity is absent, e.g. an unsaved live preview). Omitted otherwise. */
  relation?: RendererRelation | null;
}

export interface RendererCreator {
  username: string;
  name: string;
  color: string;
  avatarSeed: string | null;
}

/** A project the record belongs to, reduced to what a chip needs. */
export interface RendererProjectChip {
  id: string;
  code: string;
  color: string;
}

export interface RendererProps {
  fields: Record<string, RendererFieldValue>;
  createdAt: Date | string;
  status: string;
  creator: RendererCreator | null;
  /** The record's project membership, for read-only chips on cards/rows. */
  projects: RendererProjectChip[];
  type: { code: string; color: string; iconSeed: string | null };
}

export interface RendererTypeInput {
  code: string;
  color: string;
  iconSeed: string | null;
  layout: FormLayout | null;
  rendererId?: string | null;
}

type RendererRow = Record<string, unknown> & {
  createdAt: Date | string;
  status: string;
  creator?: RendererCreator | null;
  projects?: { projectId: string; project: RendererProjectChip }[];
};

/** Map the row's project-join rows into chip data, tolerating an unloaded join. */
function projectChips(row: RendererRow): RendererProjectChip[] {
  return (row.projects ?? []).map((p) => ({
    id: p.project.id,
    code: p.project.code,
    color: p.project.color,
  }));
}

// The joined-entity accessor for a relation field's writeTo column.
const USER_RELATION_ACCESSOR: Record<string, string> = {
  creatorId: 'creator',
  assigneeId: 'assignee',
};

/** Resolve a relation field to its target descriptor from the row's joined
 *  entity, or null when that entity isn't loaded (e.g. an unsaved preview). */
function resolveRelation(
  kind: FieldKind,
  writeTo: string,
  row: RendererRow,
): RendererRelation | null {
  if (kind === 'user') {
    const entity = row[USER_RELATION_ACCESSOR[writeTo] ?? ''] as
      | { id?: string; name?: string; color?: string; avatarSeed?: string | null }
      | null
      | undefined;
    if (!entity) return null;
    return {
      id: String(entity.id ?? ''),
      label: entity.name ?? '',
      color: entity.color,
      avatarSeed: entity.avatarSeed ?? null,
    };
  }
  if (kind === 'record') {
    const entity = row.record as
      | { id?: string; title?: string | null; note?: string | null }
      | null
      | undefined;
    if (!entity) return null;
    const id = String(entity.id ?? '');
    return { id, label: entity.title ?? entity.note ?? id };
  }
  return null;
}

/** The type's layout fields that have a value in `row`, formatted for display —
 *  the generic card/row body used when a type has no renderer. */
export function presentFields(
  row: RendererRow,
  type: RendererTypeInput,
): { id: string; label: string; value: NonNullable<FormattedFieldValue> }[] {
  const out: { id: string; label: string; value: NonNullable<FormattedFieldValue> }[] = [];
  for (const f of type.layout?.fields ?? []) {
    const value = formatFieldValue(f.kind, f.writeTo, row[f.writeTo]);
    if (value !== null) out.push({ id: f.id, label: f.label, value });
  }
  return out;
}

export function buildRendererProps(row: RendererRow, type: RendererTypeInput): RendererProps {
  const fields: Record<string, RendererFieldValue> = {};
  for (const f of type.layout?.fields ?? []) {
    const raw = row[f.writeTo];
    const isRelation = f.kind === 'user' || f.kind === 'record';
    const relation = isRelation ? resolveRelation(f.kind, f.writeTo, row) : undefined;
    fields[f.id] = {
      label: f.label,
      kind: f.kind,
      writeTo: f.writeTo,
      value: isRelation ? (relation?.label ?? null) : formatFieldValue(f.kind, f.writeTo, raw),
      raw,
      ...(isRelation ? { relation: relation ?? null } : {}),
    };
  }
  return {
    fields,
    createdAt: row.createdAt,
    status: row.status,
    creator: row.creator ?? null,
    projects: projectChips(row),
    type: { code: type.code, color: type.color, iconSeed: type.iconSeed },
  };
}

/** The correspondence thread a letter sits in: prev/next letter ids (null at an
 *  end), the current letter's 1-based position, and the thread size. Only the
 *  letter renderer surfaces this; other details ignore it. */
export interface RendererDetailThread {
  prevId: string | null;
  nextId: string | null;
  position: number;
  total: number;
}

/** A sibling letter to plot on the correspondence map: its id, endpoint names
 *  (for the path's label) and raw "lat,lng" geo strings (parsed by the renderer,
 *  the same way the live form's coordinates are). The letter renderer is the only
 *  consumer; other details ignore it. */
export interface RendererDetailMapLetter {
  id: string;
  from: string | null;
  to: string | null;
  fromGeo: string | null;
  toGeo: string | null;
  title: string | null;
}

/** Identity + chrome for the record being shown in a detail view. */
export interface RendererDetailRecord {
  id: string;
  createdAt: Date | string;
  status: string;
  creator: RendererCreator | null;
  /** rendererId lets the generic detail show the type's own card as a live preview. */
  type: { code: string; color: string; iconSeed: string | null; rendererId: string | null };
}

/**
 * The prop contract for a renderer's editable detail view. Richer than
 * {@link RendererProps}: `sf` is the live superForm (edit + reactive decoration
 * such as a map redrawn as geo fields change), `layout` drives field inputs,
 * `fields` carries the curated read values, and `thread` the correspondence
 * navigation. `onNavigate`, when present (the modal), flips to a neighbour in
 * place; when absent (standalone page), details fall back to plain links.
 * `letters` is the rest of the plottable correspondence, drawn on the map.
 */
export interface RendererDetailProps {
  sf: SuperForm<Record<string, unknown>>;
  layout: FormLayout;
  fields: Record<string, RendererFieldValue>;
  record: RendererDetailRecord;
  thread: RendererDetailThread;
  letters: RendererDetailMapLetter[];
  /** Mentions recorded in the record's text (entity links). Optional: only renderers that show
   *  annotated text read it, every other detail ignores it. */
  mentions?: MentionSpan[];
  onNavigate?: (id: string) => void;
}

export function buildRendererDetailProps(
  row: RendererRow & { id: string },
  type: RendererTypeInput,
  extra: {
    sf: SuperForm<Record<string, unknown>>;
    thread: RendererDetailThread;
    letters?: RendererDetailMapLetter[];
    mentions?: MentionSpan[];
    onNavigate?: (id: string) => void;
  },
): RendererDetailProps {
  const base = buildRendererProps(row, type);
  return {
    sf: extra.sf,
    layout: type.layout ?? { fields: [] },
    fields: base.fields,
    record: {
      id: row.id,
      createdAt: base.createdAt,
      status: base.status,
      creator: base.creator,
      type: { ...base.type, rendererId: type.rendererId ?? null },
    },
    thread: extra.thread,
    letters: extra.letters ?? [],
    ...(extra.mentions ? { mentions: extra.mentions } : {}),
    onNavigate: extra.onNavigate,
  };
}
