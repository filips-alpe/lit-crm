import { z, type ZodTypeAny } from 'zod';
import type { FieldKind } from '$lib/forms/layout';
import type { FormattedFieldValue } from '$lib/forms/format';
import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import { formatDate, formatTime } from '$lib/utils/formatDate';

/**
 * Build-time field-type registry (logic): each field type's storage columns,
 * display formatting, and validation schema. Its input component lives in
 * `./inputs` (kept separate so this module stays server-safe). To add a field
 * type: add a kind to `FIELD_KINDS`, an entry here, and an input in `./inputs`.
 */
interface FieldType {
  kind: FieldKind;
  /** Record columns this field type may be stored in. */
  columns: readonly string[];
  /** Display formatting for cards/rows. */
  format(writeTo: string, value: unknown): FormattedFieldValue;
  /** Base validation schema (the builder layers `.optional()` for non-required). */
  schema(): ZodTypeAny;
}

/**
 * Upper bounds enforced by the field schemas (R-SEC-7). Generous for real content —
 * the longest value in the seed data is ~1 KB of text — but they keep a crafted or
 * runaway submission from storing megabytes or overflowing a Decimal(12,2) column.
 */
export const FIELD_LIMITS = {
  /** Plain `text` fields (titles, notes, names, descriptions…). */
  text: 10_000,
  /** Long-form Markdown source. */
  markdown: 1_000_000,
  /** Foreign-key ids (cuid) for user/record relations. */
  id: 100,
  /** A `"lat,lng"` coordinate string. */
  location: 100,
  /** Items in a `list` field, and the length of each item. */
  listItems: 200,
  listItemLength: 1_000,
  /** Largest magnitude a number column stores (Decimal(12,2) holds 10 integer digits). */
  numberMax: 9_999_999_999.99,
} as const;

const CURRENCY_COLUMNS = new Set(['sum', 'total']);

// Every scalar string column on Record. A location field stores a `"lat,lng"`
// string, so it may write to any of these — not just the geo columns. The
// relation foreign keys (creatorId/assigneeId/recordId) and the `references`
// String[] are owned by their own kinds and intentionally excluded.
const STRING_COLUMNS = [
  'note',
  'title',
  'description',
  'text',
  'unit',
  'from',
  'to',
  'fromGeo',
  'toGeo',
] as const;

function formatText(_writeTo: string, value: unknown): FormattedFieldValue {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// Numbers and dates follow the app locale (not the host's), so the server
// render and the browser produce the same text.
function formatNumber(writeTo: string, value: unknown): FormattedFieldValue {
  // Empty is "no value"; a stored 0 is a real number and displays as 0.
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (CURRENCY_COLUMNS.has(writeTo)) {
    return n.toLocaleString(getLocale(), { style: 'currency', currency: 'EUR' });
  }
  if (writeTo === 'hours') return `${n.toLocaleString(getLocale())} h`;
  return n.toLocaleString(getLocale());
}

function formatDateValue(_writeTo: string, value: unknown): FormattedFieldValue {
  return formatDate(value as Date | string | null) || null;
}

function formatDateTimeValue(_writeTo: string, value: unknown): FormattedFieldValue {
  const date = formatDate(value as Date | string | null);
  return date ? `${date} ${formatTime(value as Date | string)}` : null;
}

function formatList(_writeTo: string, value: unknown): FormattedFieldValue {
  if (!Array.isArray(value)) return null;
  const items = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  return items.length === 0 ? null : items;
}

/**
 * Parse a scalar `"lat,lng"` coordinate string into a point, or null when it is
 * not a well-formed in-range pair. Exported so the map renderer can reuse the
 * exact same parsing the field type validates against. Stored as a string (not
 * JSON) so it flows through the scalar form/seed pipeline unchanged.
 */
export function parseLatLng(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== 'string') return null;
  const parts = value.split(',').map((p) => p.trim());
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function formatLocation(_writeTo: string, value: unknown): FormattedFieldValue {
  const p = parseLatLng(value);
  return p ? `${p.lat}, ${p.lng}` : null;
}

// Relation fields store a foreign-key id. A bare id is not a display value — the
// human-readable label is resolved from the joined entity in buildRendererProps
// (see $lib/render/props) — so the registry formatter intentionally returns null.
function formatRelation(): FormattedFieldValue {
  return null;
}

export const FIELD_TYPES: Record<FieldKind, FieldType> = {
  text: {
    kind: 'text',
    columns: ['note', 'title', 'description', 'text', 'unit', 'from', 'to'],
    format: formatText,
    schema: () => z.string().max(FIELD_LIMITS.text),
  },
  markdown: {
    kind: 'markdown',
    // Long-form text authored in Markdown and shown formatted; stored as the raw
    // source, and trimmed for the card/row summary like plain text.
    columns: ['text', 'description', 'note'],
    format: formatText,
    schema: () => z.string().max(FIELD_LIMITS.markdown),
  },
  number: {
    kind: 'number',
    columns: ['sum', 'hours', 'total'],
    format: formatNumber,
    schema: () =>
      z.coerce.number().finite().min(-FIELD_LIMITS.numberMax).max(FIELD_LIMITS.numberMax),
  },
  date: {
    kind: 'date',
    columns: ['date', 'start', 'end'],
    format: formatDateValue,
    schema: () => z.coerce.date(),
  },
  datetime: {
    kind: 'datetime',
    columns: ['date', 'start', 'end'],
    format: formatDateTimeValue,
    schema: () => z.coerce.date(),
  },
  list: {
    kind: 'list',
    columns: ['references'],
    format: formatList,
    schema: () => z.array(z.string().max(FIELD_LIMITS.listItemLength)).max(FIELD_LIMITS.listItems),
  },
  location: {
    kind: 'location',
    columns: STRING_COLUMNS,
    format: formatLocation,
    schema: () =>
      z
        .string()
        .max(FIELD_LIMITS.location)
        .refine((v) => parseLatLng(v) !== null, {
          error: () => m.red_odd_goldfish_buzz(),
        }),
  },
  user: {
    kind: 'user',
    // Foreign-key columns on Record that point at a User.
    columns: ['creatorId', 'assigneeId'],
    format: formatRelation,
    schema: () => z.string().max(FIELD_LIMITS.id),
  },
  record: {
    kind: 'record',
    // Self-relation foreign key (Record → Record, "LinkedRecord").
    columns: ['recordId'],
    format: formatRelation,
    schema: () => z.string().max(FIELD_LIMITS.id),
  },
};

export function getFieldType(kind: FieldKind): FieldType {
  return FIELD_TYPES[kind];
}
