import { z } from 'zod';
import { getFieldType } from '$lib/fields/registry';
import { isValidDefault } from '$lib/forms/defaultValue';
import * as m from '$lib/paraglide/messages.js';

export const FIELD_KINDS = [
  'text',
  'markdown',
  'number',
  'date',
  'datetime',
  'list',
  'location',
  'user',
  'record',
] as const;

const layoutFieldSchema = z.object({
  id: z.string().min(1),
  label: z
    .string()
    .trim()
    .min(1, { error: () => m.spicy_simple_macaw_coax() })
    .max(80),
  kind: z.enum(FIELD_KINDS),
  writeTo: z.string().min(1),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
});

export const layoutSchema = z
  .object({
    fields: z
      .array(layoutFieldSchema)
      .min(1, { error: () => m.quaint_next_chipmunk_earn() })
      .max(50),
  })
  // The builder only offers a kind's own columns, but the layout arrives as
  // client JSON: a crafted `writeTo` (id, status, typeId…) would otherwise flow
  // into the record write.
  .superRefine((l, ctx) => {
    l.fields.forEach((f, i) => {
      if (f.defaultValue !== undefined && !isValidDefault(f.kind, f.defaultValue)) {
        ctx.addIssue({
          code: 'custom',
          message: m.steep_bright_manatee_learn(),
          path: ['fields', i, 'defaultValue'],
        });
      }
      if (!getFieldType(f.kind).columns.includes(f.writeTo)) {
        ctx.addIssue({
          code: 'custom',
          message: m.quick_brief_cod_jest(),
          path: ['fields', i, 'writeTo'],
        });
      }
    });
  })
  .refine((l) => new Set(l.fields.map((f) => f.label)).size === l.fields.length, {
    error: () => m.dirty_grand_kitten_clip(),
    path: ['fields'],
  })
  .refine((l) => new Set(l.fields.map((f) => f.writeTo)).size === l.fields.length, {
    error: () => m.grassy_whole_pig_conquer(),
    path: ['fields'],
  });

export type Layout = z.infer<typeof layoutSchema>;

/** The column a type's layout designates as the recipient: the `to`-mapped field
 *  if present, else the `from`-mapped field, else none. */
export function recipientColumn(layout: Layout | null | undefined): 'to' | 'from' | null {
  if (!layout) return null;
  const cols = new Set(layout.fields.map((f) => f.writeTo));
  if (cols.has('to')) return 'to';
  if (cols.has('from')) return 'from';
  return null;
}

/** The color a new type starts with, shared by the create form and the schema. */
export const DEFAULT_TYPE_COLOR = '#3b82f6';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: () => m.novel_main_thrush_drop() });

export const typeSchema = z.object({
  id: z.string().default(''),
  code: z.string().trim().min(1).max(40),
  description: z.string().max(200).optional().nullable(),
  color: hexColor.default(DEFAULT_TYPE_COLOR),
  iconSeed: z.string().min(1).max(64).optional().nullable(),
  layout: layoutSchema.optional().nullable(),
  // Selected installed renderer id (from the renderer registry); null = default.
  rendererId: z.string().max(64).optional().nullable(),
});
