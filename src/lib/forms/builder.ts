import type { FieldKind, FormLayout, LayoutField } from './layout';
import { getFieldType } from '$lib/fields/registry';
import { isValidDefault, supportsDefault } from './defaultValue';
import * as m from '$lib/paraglide/messages.js';

export function columnsForKind(kind: FieldKind): readonly string[] {
  return getFieldType(kind).columns;
}

export function availableColumnsForField(
  layout: FormLayout,
  fieldId: string,
  kind: FieldKind,
): string[] {
  const taken = new Set(layout.fields.filter((f) => f.id !== fieldId).map((f) => f.writeTo));
  return columnsForKind(kind).filter((c) => !taken.has(c));
}

export function isKindAvailableForField(
  layout: FormLayout,
  fieldId: string,
  kind: FieldKind,
): boolean {
  return availableColumnsForField(layout, fieldId, kind).length > 0;
}

export function setFieldKind(layout: FormLayout, id: string, kind: FieldKind): FormLayout {
  const changed = updateField(layout, id, (field) => {
    const cols = columnsForKind(kind);
    if (cols.includes(field.writeTo)) return { kind };
    const available = availableColumnsForField(layout, id, kind);
    return { kind, writeTo: available[0] ?? cols[0] };
  });
  // A default typed for the old kind may not fit the new one; drop it then.
  const field = changed.fields.find((f) => f.id === id);
  if (
    field?.defaultValue !== undefined &&
    (!supportsDefault(kind) || !isValidDefault(kind, field.defaultValue))
  ) {
    return setFieldDefault(changed, id, undefined);
  }
  return changed;
}

export function setFieldRequired(layout: FormLayout, id: string, required: boolean): FormLayout {
  return replaceField(layout, id, (field) => {
    const next = { ...field };
    delete next.required;
    return required ? { ...next, required: true } : next;
  });
}

/** Set a field's default value; `undefined` removes it. */
export function setFieldDefault(layout: FormLayout, id: string, value: unknown): FormLayout {
  return replaceField(layout, id, (field) => {
    const next = { ...field };
    delete next.defaultValue;
    return value === undefined ? next : { ...next, defaultValue: value };
  });
}

function replaceField(
  layout: FormLayout,
  id: string,
  fn: (field: LayoutField) => LayoutField,
): FormLayout {
  if (!layout.fields.some((f) => f.id === id)) return layout;
  return { ...layout, fields: layout.fields.map((f) => (f.id === id ? fn(f) : f)) };
}

function makeFieldId(): string {
  return 'f' + Math.random().toString(36).slice(2, 10);
}

type FieldPatch =
  | Partial<Omit<LayoutField, 'id'>>
  | ((field: LayoutField) => Partial<Omit<LayoutField, 'id'>>);

export function updateField(layout: FormLayout, id: string, patch: FieldPatch): FormLayout {
  let changed = false;
  const fields = layout.fields.map((f) => {
    if (f.id !== id) return f;
    changed = true;
    const fragment = typeof patch === 'function' ? patch(f) : patch;
    return { ...f, ...fragment };
  });
  if (!changed) return layout;
  return { ...layout, fields };
}

export function canRemoveField(layout: FormLayout): boolean {
  return layout.fields.length > 1;
}

export function removeField(layout: FormLayout, id: string): FormLayout {
  if (!canRemoveField(layout)) return layout;
  const fields = layout.fields.filter((f) => f.id !== id);
  if (fields.length === layout.fields.length) return layout;
  return { ...layout, fields };
}

// Order kinds prefer when padding: lead with text so generic types get a
// usable note slot first, then number / date / list.
export const KINDS_IN_FALLBACK_ORDER: readonly FieldKind[] = ['text', 'number', 'date', 'list'];

function firstFreeSlot(layout: FormLayout): { kind: FieldKind; writeTo: string } | null {
  const used = new Set(layout.fields.map((f) => f.writeTo));
  for (const kind of KINDS_IN_FALLBACK_ORDER) {
    const writeTo = columnsForKind(kind).find((c) => !used.has(c));
    if (writeTo) return { kind, writeTo };
  }
  return null;
}

export function duplicateLabels(layout: FormLayout): Set<string> {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const f of layout.fields) {
    if (!f.label) continue;
    if (seen.has(f.label)) dups.add(f.label);
    else seen.add(f.label);
  }
  return dups;
}

function nextUniqueLabel(layout: FormLayout, base = m.north_acidic_shad_grasp()): string {
  const used = new Set(layout.fields.map((f) => f.label));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

export function addEmptyField(layout: FormLayout): FormLayout {
  const slot = firstFreeSlot(layout);
  if (!slot) return layout;
  const field: LayoutField = {
    id: makeFieldId(),
    label: nextUniqueLabel(layout),
    kind: slot.kind,
    writeTo: slot.writeTo,
  };
  return { ...layout, fields: [...layout.fields, field] };
}

// A Type must always have at least one field, so seed every new layout
// with one — the user can rename / repurpose it.
export function starterLayout(): FormLayout {
  return addEmptyField({ fields: [] });
}

export function layoutOrStarter(layout: FormLayout | null | undefined): FormLayout {
  return layout && layout.fields.length > 0 ? layout : starterLayout();
}

export interface FieldSuggestion {
  label: string;
  kind: FieldKind;
  writeTo: string;
}

export function addFieldFromSuggestion(
  layout: FormLayout,
  suggestion: FieldSuggestion,
): FormLayout {
  if (!columnsForKind(suggestion.kind).includes(suggestion.writeTo)) return layout;
  const used = new Set(layout.fields.map((f) => f.writeTo));
  if (used.has(suggestion.writeTo)) return layout;
  const field: LayoutField = {
    id: makeFieldId(),
    label: suggestion.label || nextUniqueLabel(layout),
    kind: suggestion.kind,
    writeTo: suggestion.writeTo,
  };
  return { ...layout, fields: [...layout.fields, field] };
}
