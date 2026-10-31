import { prisma } from '$lib/prisma';
import { Prisma } from '../../../../generated/prisma/client';
import { layoutSchema } from '$lib/schemas/types';
import { formatFieldValue } from '$lib/forms/format';
import type { BestPage, BestPageField, BestPageSequence, RecordRef } from '$lib/records/bestPage';

export type {
  BestPage,
  BestPageField,
  BestPageSequence,
  MentionContext,
  RecordRef,
} from '$lib/records/bestPage';

/** Mention contexts shown per page. */
export const MENTIONS_PAGE_SIZE = 50;
/** Characters of the source text kept on each side of a mention, cut in SQL. */
const CONTEXT_CHARS = 80;
const RELATED_LIMIT = 20;
/** Cap on the distinct-record lists (sources, mentioned entities). */
const LIST_LIMIT = 200;

// A mention is live only while its source is active and `text[start, end)` still reads `surface`
// (the record text may have been edited since the pipeline ran). `m` = lit_mention, `r` = its source.
const LIVE = Prisma.sql`r."status" = 'ACTIVE'
  AND substring(r."text" FROM m."start" + 1 FOR m."end" - m."start") = m."surface"`;

const num = (v: bigint | number) => Number(v);

export async function getBestPage(
  id: string,
  opts: { page?: number } = {},
): Promise<BestPage | null> {
  const row = await prisma.record.findUnique({
    where: { id },
    omit: { text: true },
    include: { type: { select: { code: true, color: true, iconSeed: true, layout: true } } },
  });
  if (!row) return null;

  const parsed = layoutSchema.safeParse(row.type.layout);
  const fields: BestPageField[] = [];
  for (const f of parsed.success ? parsed.data.fields : []) {
    // Long-form body text belongs to the record's own view, not to a summary page.
    if (f.kind === 'markdown') continue;
    const value = formatFieldValue(f.kind, f.writeTo, (row as Record<string, unknown>)[f.writeTo]);
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    fields.push({ id: f.id, label: f.label, kind: f.kind, writeTo: f.writeTo, value });
  }

  const [totalRows, variants, sources, related, mentionedEntities, sequence] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM lit_mention m JOIN lit_record r ON r.id = m."recordId"
      WHERE m."entityId" = ${id} AND ${LIVE}`,
    prisma.$queryRaw<{ surface: string; n: bigint }[]>`
      SELECT m."surface", count(*) AS n FROM lit_mention m JOIN lit_record r ON r.id = m."recordId"
      WHERE m."entityId" = ${id} AND ${LIVE}
      GROUP BY m."surface" ORDER BY n DESC, m."surface" ASC`,
    prisma.$queryRaw<{ id: string; title: string | null; code: string; n: bigint }[]>`
      SELECT r.id, r.title, t.code, count(*) AS n
      FROM lit_mention m JOIN lit_record r ON r.id = m."recordId" JOIN lit_type t ON t.id = r."typeId"
      WHERE m."entityId" = ${id} AND ${LIVE}
      GROUP BY r.id, r.title, t.code, r."createdAt"
      ORDER BY n DESC, r."createdAt" ASC, r.id ASC LIMIT ${LIST_LIMIT}`,
    prisma.$queryRaw<{ id: string; title: string | null; code: string; n: bigint }[]>`
      SELECT e.id, e.title, t.code, count(DISTINCT m2."recordId") AS n
      FROM lit_mention m
      JOIN lit_record r ON r.id = m."recordId"
      JOIN lit_mention m2 ON m2."recordId" = m."recordId" AND m2."entityId" <> m."entityId"
        AND substring(r."text" FROM m2."start" + 1 FOR m2."end" - m2."start") = m2."surface"
      JOIN lit_record e ON e.id = m2."entityId" AND e."status" = 'ACTIVE'
      JOIN lit_type t ON t.id = e."typeId"
      WHERE m."entityId" = ${id} AND ${LIVE}
      GROUP BY e.id, e.title, t.code
      ORDER BY n DESC, e.title ASC, e.id ASC LIMIT ${RELATED_LIMIT}`,
    prisma.$queryRaw<{ id: string; title: string | null; code: string; n: bigint }[]>`
      SELECT e.id, e.title, t.code, count(*) AS n
      FROM lit_mention m
      JOIN lit_record r ON r.id = m."recordId"
      JOIN lit_record e ON e.id = m."entityId" AND e."status" = 'ACTIVE'
      JOIN lit_type t ON t.id = e."typeId"
      WHERE m."recordId" = ${id} AND ${LIVE}
      GROUP BY e.id, e.title, t.code
      ORDER BY n DESC, e.title ASC, e.id ASC LIMIT ${LIST_LIMIT}`,
    sequenceOf(row),
  ]);

  const total = num(totalRows[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / MENTIONS_PAGE_SIZE));
  const requested = Number.isFinite(opts.page) ? Math.trunc(opts.page as number) : 1;
  const page = Math.min(Math.max(requested, 1), totalPages);

  const contexts = total
    ? await prisma.$queryRaw<
        {
          recordId: string;
          title: string | null;
          code: string;
          start: number;
          end: number;
          surface: string;
          before: string;
          after: string;
        }[]
      >`
      SELECT m."recordId", r.title, t.code, m."start", m."end", m."surface",
        substring(r."text" FROM greatest(m."start" - ${CONTEXT_CHARS}, 0) + 1
                  FOR m."start" - greatest(m."start" - ${CONTEXT_CHARS}, 0)) AS before,
        substring(r."text" FROM m."end" + 1 FOR ${CONTEXT_CHARS}) AS after
      FROM lit_mention m JOIN lit_record r ON r.id = m."recordId" JOIN lit_type t ON t.id = r."typeId"
      WHERE m."entityId" = ${id} AND ${LIVE}
      ORDER BY r."createdAt" ASC, r.id ASC, m."start" ASC
      LIMIT ${MENTIONS_PAGE_SIZE} OFFSET ${(page - 1) * MENTIONS_PAGE_SIZE}`
    : [];

  const ref = (r: { id: string; title: string | null; code: string; n: bigint }): RecordRef => ({
    id: r.id,
    title: r.title,
    typeCode: r.code,
    count: num(r.n),
  });

  return {
    id: row.id,
    title: row.title,
    type: { code: row.type.code, color: row.type.color, iconSeed: row.type.iconSeed },
    fields,
    references: row.references,
    variants: variants.map((v) => ({ surface: v.surface, count: num(v.n) })),
    mentions: {
      items: contexts.map((c) => ({
        recordId: c.recordId,
        recordTitle: c.title,
        typeCode: c.code,
        start: c.start,
        end: c.end,
        surface: c.surface,
        before: c.before,
        after: c.after,
      })),
      page,
      pageSize: MENTIONS_PAGE_SIZE,
      total,
      totalPages,
    },
    sources: sources.map(ref),
    related: related.map(ref),
    mentionedEntities: mentionedEntities.map(ref),
    sequence,
  };
}

/** Position and neighbours of a record among the active records of the first project (by code) it
 *  belongs to, in creation order. Null when it belongs to none. */
async function sequenceOf(row: { id: string; createdAt: Date }): Promise<BestPageSequence | null> {
  const membership = await prisma.projectRecord.findFirst({
    where: { recordId: row.id },
    orderBy: { project: { code: 'asc' } },
    select: { projectId: true },
  });
  if (!membership) return null;
  const inProject = {
    status: 'ACTIVE' as const,
    projects: { some: { projectId: membership.projectId } },
  };
  const before = {
    OR: [{ createdAt: { lt: row.createdAt } }, { createdAt: row.createdAt, id: { lt: row.id } }],
  };
  const after = {
    OR: [{ createdAt: { gt: row.createdAt } }, { createdAt: row.createdAt, id: { gt: row.id } }],
  };
  const pick = { id: true, title: true } as const;
  const [preceding, total, prev, next] = await Promise.all([
    prisma.record.count({ where: { ...inProject, ...before } }),
    prisma.record.count({ where: inProject }),
    prisma.record.findFirst({
      where: { ...inProject, ...before },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: pick,
    }),
    prisma.record.findFirst({
      where: { ...inProject, ...after },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: pick,
    }),
  ]);
  return { position: preceding + 1, total, prev, next };
}
