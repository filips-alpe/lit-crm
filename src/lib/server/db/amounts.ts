import { Prisma } from '../../../../generated/prisma/client';
import { ownerFallback, prisma } from '$lib/prisma';

export { AMOUNT_COLUMNS, isAmountColumn } from '$lib/fields/amounts';

/**
 * The relation to read amounts from: the view `lit_record_amount` (one row per readable
 * record, amounts NULL and masked = true where no access path shows them, canWrite). The
 * restricted role has no privilege on the columns themselves. In the test-only owner
 * fallback there is no acting user, so an equivalent unmasked relation over the table is
 * used. Use as `FROM ${amountRelation()} a`.
 */
export function amountRelation(): Prisma.Sql {
  return ownerFallback()
    ? Prisma.sql`(SELECT "id" AS "recordId", "sum", "hours", "total", false AS "masked", true AS "canWrite" FROM "lit_record") `
    : Prisma.sql`"lit_record_amount" `;
}

export type RecordAccess = {
  sum: number | null;
  hours: number | null;
  total: number | null;
  /** True when no access path shows the amounts: render as hidden, not as empty. */
  amountsMasked: boolean;
  /** The user may edit and delete the record. */
  canWrite: boolean;
};

const MASKED: RecordAccess = {
  sum: null,
  hours: null,
  total: null,
  amountsMasked: true,
  canWrite: false,
};

const num = (v: unknown) => (v == null ? null : Number(v));

/** Amounts, mask and write access for these records, keyed by id. Unknown ids (not
 *  readable by the acting user) are absent from the map. */
export async function recordAccess(ids: string[]): Promise<Map<string, RecordAccess>> {
  const out = new Map<string, RecordAccess>();
  if (ids.length === 0) return out;
  const rows = await prisma.$queryRaw<
    {
      recordId: string;
      sum: Prisma.Decimal | null;
      hours: number | null;
      total: Prisma.Decimal | null;
      masked: boolean;
      canWrite: boolean;
    }[]
  >`SELECT a."recordId", a."sum", a."hours", a."total", a."masked", a."canWrite"
    FROM ${amountRelation()} a WHERE a."recordId" = ANY(${ids}::text[])`;
  for (const r of rows) {
    out.set(r.recordId, {
      sum: num(r.sum),
      hours: num(r.hours),
      total: num(r.total),
      amountsMasked: r.masked,
      canWrite: r.canWrite,
    });
  }
  return out;
}

/** Merge access into rows read through Prisma (which never selects the amount columns). */
export async function withAccess<T extends { id: string }>(
  rows: T[],
): Promise<(T & RecordAccess)[]> {
  const access = await recordAccess(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, ...(access.get(r.id) ?? MASKED) }));
}
