import type { FormLayout } from './layout';

/** Why a saved field's data would stop showing after the edit. */
export type LayoutImpactReason = 'removed' | 'kind' | 'column';

export interface LayoutImpact {
  fieldId: string;
  /** The field's label as saved. */
  label: string;
  reason: LayoutImpactReason;
  /** The record column that holds the data being orphaned. */
  column: string;
  /** How many existing records hold a value there. */
  count: number;
}

/**
 * Compare the layout as saved with the unsaved edit and list the fields whose
 * existing data would no longer be shown: removed, or moved off the column they
 * were saved against (a kind change that forces a different column is reported
 * as `kind`). A column that another field still writes to keeps its data
 * visible, so it is not reported. `counts` is records-with-data per column.
 */
export function layoutImpacts(
  saved: FormLayout,
  current: FormLayout,
  counts: Record<string, number>,
): LayoutImpact[] {
  const nowById = new Map(current.fields.map((f) => [f.id, f]));
  const writtenNow = new Set(current.fields.map((f) => f.writeTo));
  const out: LayoutImpact[] = [];
  for (const before of saved.fields) {
    const count = counts[before.writeTo] ?? 0;
    if (count === 0) continue;
    const after = nowById.get(before.id);
    const base = { fieldId: before.id, label: before.label, column: before.writeTo, count };
    if (!after) {
      if (!writtenNow.has(before.writeTo)) out.push({ ...base, reason: 'removed' });
    } else if (after.writeTo !== before.writeTo && !writtenNow.has(before.writeTo)) {
      out.push({ ...base, reason: after.kind !== before.kind ? 'kind' : 'column' });
    }
  }
  return out;
}
