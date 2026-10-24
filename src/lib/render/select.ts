import type { RendererFieldValue } from './props';
import type { FormattedFieldValue } from '$lib/forms/format';

/**
 * Selection helpers for renderers. A renderer receives `fields` keyed by field
 * id (see {@link RendererFieldValue}); these let it pull a field out by its
 * semantic `writeTo` column instead of guessing at ids — so a "money" renderer
 * can ask for `sum`, a "correspondence" renderer for `from`/`to`, etc. Kept
 * server-safe (no Svelte) so the logic is unit-testable on its own.
 */

type Fields = Record<string, RendererFieldValue>;

/** The first field that writes to `col`, or undefined. */
export function byWriteTo(fields: Fields, col: string): RendererFieldValue | undefined {
  return Object.values(fields).find((f) => f.writeTo === col);
}

/** The first field matching any of `cols`, tried in priority order. */
export function firstByWriteTo(fields: Fields, cols: string[]): RendererFieldValue | undefined {
  for (const col of cols) {
    const f = byWriteTo(fields, col);
    if (f) return f;
  }
  return undefined;
}

/** Whether a field exists and carries a non-empty formatted value. */
export function present(f: RendererFieldValue | undefined): f is RendererFieldValue {
  return !!f && f.value !== null;
}

/** A field's formatted value as a single string (lists joined with ", "). */
export function asText(value: FormattedFieldValue): string {
  if (value == null) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

/** A field's display text by `writeTo` column, or null when absent or empty. */
export function textOf(fields: Fields, col: string): string | null {
  const f = byWriteTo(fields, col);
  return present(f) ? asText(f.value) : null;
}

/** The shared letter header: direction, the other party's name, and the subject. */
export function letterSummary(fields: Fields) {
  return {
    outgoing: present(byWriteTo(fields, 'to')),
    correspondent: textOf(fields, 'to') ?? textOf(fields, 'from'),
    title: textOf(fields, 'title') ?? '',
  };
}
