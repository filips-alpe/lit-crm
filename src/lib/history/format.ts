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
