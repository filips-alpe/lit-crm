import { getFieldType } from '$lib/fields/registry';
import { fromInputValue, inputTypeFor, toInputValue } from '$lib/fields/inputHelpers';
import type { FieldKind } from './layout';

/** Relation kinds point at a specific user/record, which a type definition can't
 *  meaningfully preselect; every other kind can carry a typed default. */
export function supportsDefault(kind: FieldKind): boolean {
  return kind !== 'user' && kind !== 'record';
}

/** Whether `value` is an acceptable stored default for a field of this kind
 *  (the same schema the record form validates entries against). */
export function isValidDefault(kind: FieldKind, value: unknown): boolean {
  return getFieldType(kind).schema().safeParse(value).success;
}

/** A stored default as the text its editor control shows. */
export function defaultToText(kind: FieldKind, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (kind === 'list') return Array.isArray(value) ? value.join('\n') : '';
  if (kind === 'date' || kind === 'datetime') return toInputValue(inputTypeFor(kind), value);
  return String(value);
}

export type ParsedDefault = { ok: true; value: unknown } | { ok: false };

/**
 * Turn the editor's text into a stored default. Empty text means "no default"
 * (`value: undefined`); text that doesn't fit the kind (not a number, bad date,
 * malformed coordinates…) is rejected rather than stored.
 */
export function parseDefault(kind: FieldKind, raw: string): ParsedDefault {
  if (raw.trim() === '') return { ok: true, value: undefined };
  let value: unknown;
  switch (kind) {
    case 'number':
      value = Number(raw);
      break;
    case 'list':
      value = raw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      break;
    case 'date':
    case 'datetime':
      value = fromInputValue(kind, raw);
      break;
    default:
      value = raw;
  }
  return isValidDefault(kind, value) ? { ok: true, value } : { ok: false };
}
