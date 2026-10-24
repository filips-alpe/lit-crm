import { z, type ZodTypeAny } from 'zod';
import { getFieldType } from '$lib/fields/registry';
import type { FIELD_KINDS, Layout } from '$lib/schemas/types';
import * as m from '$lib/paraglide/messages.js';

export type FieldKind = (typeof FIELD_KINDS)[number];
export type FormLayout = Layout;
export type LayoutField = Layout['fields'][number];

export function defaultsFromLayout(layout: FormLayout): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of layout.fields) {
    if (out[f.writeTo] !== undefined) continue;
    if (f.kind === 'list') {
      out[f.writeTo] = f.defaultValue ?? [];
    } else if (f.defaultValue !== undefined) {
      out[f.writeTo] = f.defaultValue;
    }
  }
  return out;
}

export function buildLayoutSchema(layout: FormLayout) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of layout.fields) {
    if (shape[f.writeTo]) continue;
    let s = getFieldType(f.kind).schema();
    if (f.required) {
      // A required field must actually hold something: '' and [] are empty.
      s = s.refine((v) => v !== '' && !(Array.isArray(v) && v.length === 0), {
        error: () => m.good_minor_gull_buzz(),
      });
    } else {
      s = s.optional();
    }
    shape[f.writeTo] = s;
  }
  return z.object(shape);
}

/** The full record-form schema: the type's layout fields plus the universal
 *  project multiselect (`projectIds`), which lives on every record form
 *  regardless of type and defaults to an empty selection. */
export function buildRecordFormSchema(layout: FormLayout) {
  return buildLayoutSchema(layout).extend({
    projectIds: z.array(z.string()).default([]),
  });
}

/** Form defaults for a new record: layout defaults plus an empty project list. */
export function recordFormDefaults(layout: FormLayout): Record<string, unknown> {
  return { ...defaultsFromLayout(layout), projectIds: [] };
}

export function toSaveInput(layout: FormLayout, data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const f of layout.fields) {
    if (seen.has(f.writeTo)) continue;
    seen.add(f.writeTo);
    if (data[f.writeTo] !== undefined) out[f.writeTo] = data[f.writeTo];
  }
  return out;
}

/**
 * Seed a form from an existing record — the read counterpart of {@link toSaveInput}.
 * Reads each field's `writeTo` column off the record; list fields fall back to `[]`,
 * and empty (null/undefined) columns are omitted so optional inputs render blank.
 * Dates pass through as-is; the scalar input formats them for display.
 */
export function valuesFromRecord(
  layout: FormLayout,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of layout.fields) {
    if (out[f.writeTo] !== undefined) continue;
    const raw = record[f.writeTo];
    if (f.kind === 'list') {
      out[f.writeTo] = Array.isArray(raw) ? raw : [];
    } else if (raw !== null && raw !== undefined) {
      out[f.writeTo] = raw;
    }
  }
  return out;
}

/** Superforms id for a record's detail form. Same-layout forms otherwise share
 *  a schema-derived id, which collides when one detail replaces another. */
export function recordFormId(recordId: string): string {
  return `record-${recordId}`;
}
