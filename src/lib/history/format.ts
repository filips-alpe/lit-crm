import { formatDate, formatTime } from '$lib/utils/formatDate';

const MAX_VALUE = 80;

/** A changed value as one short line; `empty` stands in for null and blank. */
export function historyValue(v: unknown, empty: string): string {
  if (v == null || v === '') return empty;
  const s = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s === '') return empty;
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > MAX_VALUE ? `${one.slice(0, MAX_VALUE - 1)}…` : one;
}

/** A column's label: the type layout's label for the field that writes it, else the column. */
export function historyColumnLabel(
  column: string,
  layout: { fields: { label: string; writeTo: string }[] },
): string {
  return layout.fields.find((f) => f.writeTo === column)?.label || column;
}

const DATE_ONLY = new Set(['date']);
const DATE_TIME = new Set(['start', 'end']);

/**
 * A changed value as the panel shows it: dates in the app's locale format, relation ids as
 * the title or name they resolve to (`hidden` when the viewer cannot read it, `untitled`
 * when it has no title), everything else through `historyValue`.
 */
export function historyDisplay(
  column: string,
  value: unknown,
  ref: { label: string | null } | undefined,
  text: { empty: string; hidden: string; untitled: string },
): string {
  if (ref && typeof value === 'string')
    return historyValue(ref.label === null ? text.hidden : ref.label || text.untitled, text.empty);
  if ((DATE_ONLY.has(column) || DATE_TIME.has(column)) && typeof value === 'string') {
    const day = formatDate(value);
    if (!day) return historyValue(value, text.empty);
    return DATE_TIME.has(column) ? `${day} ${formatTime(value)}` : day;
  }
  return historyValue(value, text.empty);
}
