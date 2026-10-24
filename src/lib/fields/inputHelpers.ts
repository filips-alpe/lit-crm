import type { FieldKind } from '$lib/forms/layout';

export const inputBorder = (hasError: boolean) =>
  hasError ? 'border-red-500 bg-red-50' : 'border-stone-300';

export function inputTypeFor(kind: FieldKind): 'text' | 'number' | 'date' | 'datetime-local' {
  if (kind === 'number') return 'number';
  if (kind === 'date') return 'date';
  if (kind === 'datetime') return 'datetime-local';
  return 'text';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Convention: a date/datetime value is a UTC wall-clock. The time a user types
 *  into a `datetime-local` input is stored as that same time in UTC and shown back
 *  (formatDate/formatTime, UTC) unchanged, whatever zone the browser or server is
 *  in. Returns the `value` an `<input type>` needs for a stored Date / ISO string. */
export function toInputValue(type: ReturnType<typeof inputTypeFor>, v: unknown): string {
  if (v == null || v === '') return '';
  if (type === 'date' || type === 'datetime-local') {
    const d = v instanceof Date ? v : new Date(v as string);
    if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v : '';
    const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return type === 'date' ? ymd : `${ymd}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  return String(v);
}

/** The inverse for datetimes: a zone-less `datetime-local` string would be parsed
 *  in the host's zone by `new Date`, so mark it UTC. Date-only values are already
 *  parsed as UTC; anything that isn't a bare local datetime passes through. */
export function fromInputValue(kind: FieldKind, raw: string): string | undefined {
  if (raw === '') return undefined;
  if (kind === 'datetime' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw)) {
    return `${raw}Z`;
  }
  return raw;
}
