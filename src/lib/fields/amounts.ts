/** The money-like record columns the database masks per user (grants_rls, "Amounts"). */
export const AMOUNT_COLUMNS = ['sum', 'hours', 'total'] as const;
export const isAmountColumn = (c: string): boolean =>
  (AMOUNT_COLUMNS as readonly string[]).includes(c);

/** The layout without the amount fields the viewer cannot see: they are neither validated
 *  nor saved (writing the masked NULL back would clear them). */
export function withoutMaskedAmounts<L extends { fields: { kind: string; writeTo: string }[] }>(
  layout: L,
  masked: boolean,
): L {
  if (!masked) return layout;
  return {
    ...layout,
    fields: layout.fields.filter((f) => !(f.kind === 'number' && isAmountColumn(f.writeTo))),
  };
}
