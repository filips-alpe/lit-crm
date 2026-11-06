import { prisma } from '$lib/prisma';
import { layoutSchema } from '$lib/schemas/types';
import type { BestPageInput, RecordRef, RelatedEntity } from '$lib/bestPage/assemble';

/** How much text either side of a mention the database sends for its context. */
const SLICE_RADIUS = 160;
/** Caps that keep a much-mentioned entity's page light. */
const INCOMING_LIMIT = 1500;
const RELATED_LIMIT = 24;
const CHILDREN_LIMIT = 50;

const refSelect = {
  id: true,
  title: true,
  date: true,
  type: { select: { code: true, color: true } },
} as const;

type RefRow = {
  id: string;
  title: string | null;
  date: Date | null;
  type: { code: string; color: string };
};

const toRef = (r: RefRow): RecordRef => ({
  id: r.id,
  title: r.title,
  typeCode: r.type.code,
  typeColor: r.type.color,
  date: r.date ? r.date.toISOString().slice(0, 10) : null,
});

type IncomingRow = {
  sourceId: string;
  start: number;
  end: number;
  title: string | null;
  date: Date | null;
  code: string;
  color: string;
  sliceStart: number;
  slice: string | null;
};

type RelatedRow = {
  id: string;
  title: string | null;
  date: Date | null;
  code: string;
  color: string;
  count: number;
};

/**
 * Loads what the best page of record `id` is assembled from; null if there is
 * no such active record. Mention contexts are cut in SQL (`substring` counts
 * characters, which equals the UTF-16 offsets for the BMP-only text stored).
 */
export async function loadBestPageInput(id: string): Promise<BestPageInput | null> {
  const record = await prisma.record.findFirst({
    where: { id, status: 'ACTIVE' },
    include: {
      type: { select: { code: true, color: true, iconSeed: true, layout: true } },
      creator: { select: { name: true } },
      assignee: { select: { name: true } },
      record: { select: refSelect },
      records: {
        where: { status: 'ACTIVE' },
        select: refSelect,
        orderBy: { createdAt: 'asc' },
        take: CHILDREN_LIMIT,
      },
    },
  });
  if (!record) return null;
  const parsed = layoutSchema.safeParse(record.type.layout);
  const layout = parsed.success ? parsed.data : { fields: [] };

  const [outgoing, incoming, incomingTotal, related] = await Promise.all([
    prisma.recordMention.findMany({
      where: { sourceId: id },
      select: { start: true, end: true, entityId: true },
      orderBy: { start: 'asc' },
    }),
    prisma.$queryRaw<IncomingRow[]>`
      SELECT m."sourceId", m."start", m."end", r."title", r."date", t."code", t."color",
        GREATEST(m."start" - ${SLICE_RADIUS}, 0)::int AS "sliceStart",
        substring(r."text" FROM GREATEST(m."start" - ${SLICE_RADIUS}, 0) + 1
          FOR m."end" - GREATEST(m."start" - ${SLICE_RADIUS}, 0) + ${SLICE_RADIUS}) AS "slice"
      FROM "lit_record_mention" m
      JOIN "lit_record" r ON r."id" = m."sourceId"
      JOIN "lit_type" t ON t."id" = r."typeId"
      WHERE m."entityId" = ${id} AND r."status" = 'ACTIVE'
      ORDER BY r."createdAt" ASC, m."start" ASC
      LIMIT ${INCOMING_LIMIT}`,
    prisma.recordMention.count({ where: { entityId: id, source: { status: 'ACTIVE' } } }),
    prisma.$queryRaw<RelatedRow[]>`
      WITH src AS (
        SELECT DISTINCT "sourceId" FROM "lit_record_mention" WHERE "entityId" = ${id}
      )
      SELECT e."id", e."title", e."date", t."code", t."color",
        COUNT(DISTINCT m."sourceId")::int AS "count"
      FROM "lit_record_mention" m
      JOIN src ON src."sourceId" = m."sourceId"
      JOIN "lit_record" e ON e."id" = m."entityId"
      JOIN "lit_type" t ON t."id" = e."typeId"
      WHERE m."entityId" <> ${id} AND e."status" = 'ACTIVE'
      GROUP BY e."id", e."title", e."date", t."code", t."color"
      ORDER BY "count" DESC, e."title" ASC
      LIMIT ${RELATED_LIMIT}`,
  ]);

  const namedIds = [...new Set(outgoing.map((m) => m.entityId))];
  const named = namedIds.length
    ? await prisma.record.findMany({
        where: { id: { in: namedIds }, status: 'ACTIVE' },
        select: refSelect,
      })
    : [];
  const namedById = new Map(named.map((n) => [n.id, n]));

  return {
    record: {
      ...record,
      record: record.record ? toRef(record.record) : null,
    },
    type: {
      code: record.type.code,
      color: record.type.color,
      iconSeed: record.type.iconSeed,
      layout,
    },
    outgoing: outgoing
      .filter((m) => namedById.has(m.entityId))
      .map((m) => ({ ...m, entityTitle: namedById.get(m.entityId)?.title ?? undefined })),
    named: named.map(toRef),
    incoming: incoming.map((m) => ({
      source: {
        id: m.sourceId,
        title: m.title,
        typeCode: m.code,
        typeColor: m.color,
        date: m.date ? m.date.toISOString().slice(0, 10) : null,
      },
      start: m.start,
      end: m.end,
      slice: m.slice ?? '',
      sliceStart: m.sliceStart,
    })),
    incomingTotal,
    related: related.map(
      (r): RelatedEntity => ({
        id: r.id,
        title: r.title,
        typeCode: r.code,
        typeColor: r.color,
        date: r.date ? r.date.toISOString().slice(0, 10) : null,
        count: r.count,
      }),
    ),
    children: record.records.map(toRef),
  };
}
