import type { FieldKind } from './layout';
import { getFieldType } from '$lib/fields/registry';

export type FormattedFieldValue = string | string[] | null;

// Display formatting is owned by the field-type registry; this stays as the
// stable call site used by cards/rows. (registry imports only the type above,
// so there's no runtime import cycle.)
export function formatFieldValue(
  kind: FieldKind,
  writeTo: string,
  value: unknown,
): FormattedFieldValue {
  return getFieldType(kind).format(writeTo, value);
}
