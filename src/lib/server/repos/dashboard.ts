import { Prisma } from '../../../../generated/prisma/client';
import { prisma } from '$lib/prisma';
import { recordInclude } from '$lib/server/repos/records';
import { parseLatLng } from '$lib/fields/registry';
import type { FormLayout } from '$lib/forms/layout';
import { fillYears, foldCorrespondents, roleOf, type PartyPair } from '$lib/dashboards/aggregate';
import {
  DASHBOARD_CORRESPONDENTS_LIMIT,
  DASHBOARD_GEO_LIMIT,
  DASHBOARD_LIST_LIMIT,
  DASHBOARD_TYPE_LIST_LIMIT,
  DASHBOARD_RECORDS_LIMIT,
} from '$lib/dashboards/limits';
import type {
  DashboardData,
  DashboardRecord,
  DashboardUser,
  GeoRoute,
  MoneyTotal,
  ProjectCount,
  TypeCount,
} from '$lib/dashboards/types';

// All aggregates run in Postgres over the user's ACTIVE records (created or
// assigned). User data only ever reaches SQL as bound parameters.
const EVENT = Prisma.sql`COALESCE(r."date", r."start")`;
const SORT_KEY = Prisma.sql`COALESCE(r."date", r."start", r."createdAt")`;
const FROM_RECORDS = (userId: string) => Prisma.sql`
  FROM "lit_record" r
  WHERE r."status" = 'ACTIVE' AND (r."creatorId" = ${userId} OR r."assigneeId" = ${userId})`;
// "C" collation = byte order, matching the JS `<` comparison of ids.
const NEWEST_FIRST = Prisma.sql`ORDER BY ${SORT_KEY} DESC, r."id" COLLATE "C" DESC`;
const OLDEST_FIRST = Prisma.sql`ORDER BY ${SORT_KEY} ASC, r."id" COLLATE "C" ASC`;

const num = (v: bigint | number | Prisma.Decimal | null | undefined) => (v == null ? 0 : Number(v));

async function ids(userId: string, extra: Prisma.Sql, order: Prisma.Sql, limit: number) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT r."id" ${FROM_RECORDS(userId)} ${extra} ${order} LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

/** The newest `limit` record ids of each type (`ids` is not enough: it ranks across all types). */
async function idsPerType(userId: string, limit: number) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT s."id" FROM (
      SELECT r."id", r."typeId", ${SORT_KEY} AS k,
        row_number() OVER (PARTITION BY r."typeId" ORDER BY ${SORT_KEY} DESC, r."id" COLLATE "C" DESC) AS rn
      ${FROM_RECORDS(userId)}
    ) s WHERE s.rn <= ${limit}
    ORDER BY s.k DESC, s."id" COLLATE "C" DESC`;
  return rows.map((r) => r.id);
}

/**
 * Everything the signed-in user's dashboard draws from, aggregated in SQL with
 * capped record lists (see `$lib/dashboards/limits`). `now` splits recent from
 * upcoming. `text` is left out of records (book-length on some) and Decimal
 * columns are coerced to numbers so the result is serializable.
 */
export async function loadDashboardData(
  user: DashboardUser,
  now: Date = new Date(),
): Promise<DashboardData> {
  const userId = user.id;
  const nowTs = Prisma.sql`${now}::timestamptz`;
  const owned = {
    status: 'ACTIVE' as const,
    OR: [{ creatorId: userId }, { assigneeId: userId }],
  };

  const [
    totals,
    typeRows,
    yearRows,
    pairRows,
    projectRows,
    moneyRows,
    latestIds,
    recentIds,
    upcomingIds,
    perTypeIds,
    geoRows,
  ] = await Promise.all([
    prisma.$queryRaw<
      {
        total: bigint;
        created: bigint;
        assigned: bigint;
        earliest: Date | null;
        latest: Date | null;
      }[]
    >`SELECT count(*) AS total,
        count(*) FILTER (WHERE r."creatorId" = ${userId}) AS created,
        count(*) FILTER (WHERE r."assigneeId" = ${userId}) AS assigned,
        min(${EVENT}) AS earliest, max(${EVENT}) AS latest
      ${FROM_RECORDS(userId)}`,
    prisma.$queryRaw<{ typeId: string; count: bigint; created: bigint; assigned: bigint }[]>`
      SELECT r."typeId", count(*) AS count,
        count(*) FILTER (WHERE r."creatorId" = ${userId}) AS created,
        count(*) FILTER (WHERE r."assigneeId" = ${userId}) AS assigned
      ${FROM_RECORDS(userId)} GROUP BY r."typeId"`,
    prisma.$queryRaw<{ year: number; count: bigint }[]>`
      SELECT EXTRACT(YEAR FROM ${EVENT} AT TIME ZONE 'UTC')::int AS year, count(*) AS count
      ${FROM_RECORDS(userId)} AND ${EVENT} IS NOT NULL GROUP BY 1`,
    prisma.$queryRaw<
      { from: string | null; to: string | null; n: bigint; first: Date | null; last: Date | null }[]
    >`SELECT r."from", r."to", count(*) AS n, min(${EVENT}) AS first, max(${EVENT}) AS last
      ${FROM_RECORDS(userId)} AND (r."from" IS NOT NULL OR r."to" IS NOT NULL)
      GROUP BY r."from", r."to"
      ORDER BY max(${SORT_KEY}) DESC, r."from" COLLATE "C", r."to" COLLATE "C"`,
    prisma.projectRecord.groupBy({
      by: ['projectId'],
      where: { record: owned },
      _count: { _all: true },
    }),
    prisma.$queryRaw<
      {
        typeId: string;
        unit: string | null;
        count: bigint;
        sum: Prisma.Decimal;
        total: Prisma.Decimal;
      }[]
    >`SELECT r."typeId", max(r."unit") AS unit, count(*) AS count,
        COALESCE(sum(r."sum"), 0) AS sum, COALESCE(sum(r."total"), 0) AS total
      ${FROM_RECORDS(userId)} AND (r."sum" IS NOT NULL OR r."total" IS NOT NULL)
      GROUP BY r."typeId", COALESCE(r."unit", '')`,
    ids(userId, Prisma.empty, NEWEST_FIRST, DASHBOARD_RECORDS_LIMIT),
    ids(
      userId,
      Prisma.sql`AND (${EVENT} IS NULL OR ${EVENT} <= ${nowTs})`,
      NEWEST_FIRST,
      DASHBOARD_LIST_LIMIT,
    ),
    ids(userId, Prisma.sql`AND ${EVENT} > ${nowTs}`, OLDEST_FIRST, DASHBOARD_LIST_LIMIT),
    idsPerType(userId, DASHBOARD_TYPE_LIST_LIMIT),
    prisma.$queryRaw<
      {
        id: string;
        title: string | null;
        from: string | null;
        to: string | null;
        fromGeo: string | null;
        toGeo: string | null;
        date: Date | null;
      }[]
    >`SELECT r."id", r."title", r."from", r."to", r."fromGeo", r."toGeo", ${EVENT} AS date
      ${FROM_RECORDS(userId)} AND (r."fromGeo" IS NOT NULL OR r."toGeo" IS NOT NULL)
      ${NEWEST_FIRST} LIMIT ${DASHBOARD_GEO_LIMIT}`,
  ]);

  const [types, projects, rows] = await Promise.all([
    prisma.type.findMany({
      where: { id: { in: typeRows.map((t) => t.typeId).concat(moneyRows.map((m) => m.typeId)) } },
      select: { id: true, code: true, color: true, iconSeed: true },
    }),
    prisma.project.findMany({
      where: { id: { in: projectRows.map((p) => p.projectId) } },
      select: { id: true, code: true, color: true },
    }),
    prisma.record.findMany({
      where: {
        id: { in: [...new Set([...latestIds, ...recentIds, ...upcomingIds, ...perTypeIds])] },
      },
      omit: { text: true },
      include: {
        type: recordInclude.type,
        creator: recordInclude.creator,
        assignee: recordInclude.assignee,
        projects: recordInclude.projects,
      },
    }),
  ]);

  const typeById = new Map(types.map((t) => [t.id, t]));
  const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);

  const byId = new Map<string, DashboardRecord>(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        createdAt: r.createdAt,
        status: r.status,
        title: r.title,
        description: r.description,
        note: r.note,
        references: r.references,
        date: r.date,
        start: r.start,
        end: r.end,
        sum: r.sum == null ? null : Number(r.sum),
        hours: r.hours,
        total: r.total == null ? null : Number(r.total),
        unit: r.unit,
        from: r.from,
        to: r.to,
        fromGeo: r.fromGeo,
        toGeo: r.toGeo,
        type: { ...r.type, layout: r.type.layout as FormLayout | null },
        creator: r.creator,
        assignee: r.assignee,
        projects: r.projects,
        role: roleOf(r, userId),
      },
    ]),
  );
  const pick = (list: string[]) => list.map((id) => byId.get(id)).filter((r) => r !== undefined);

  const { total, created, assigned, earliest, latest } = totals[0];

  const countsByType: TypeCount[] = typeRows
    .flatMap((t) => {
      const type = typeById.get(t.typeId);
      return type
        ? [
            {
              typeId: type.id,
              code: type.code,
              color: type.color,
              iconSeed: type.iconSeed,
              count: num(t.count),
              created: num(t.created),
              assigned: num(t.assigned),
            },
          ]
        : [];
    })
    .sort((a, b) => b.count - a.count || byCode(a, b));

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const projectCounts: ProjectCount[] = projectRows
    .flatMap((p) => {
      const project = projectById.get(p.projectId);
      return project ? [{ ...project, count: p._count._all }] : [];
    })
    .sort((a, b) => b.count - a.count || byCode(a, b));

  const money: MoneyTotal[] = moneyRows
    .flatMap((m) => {
      const type = typeById.get(m.typeId);
      return type
        ? [
            {
              typeId: type.id,
              code: type.code,
              color: type.color,
              unit: m.unit,
              count: num(m.count),
              sum: num(m.sum),
              total: num(m.total),
            },
          ]
        : [];
    })
    .sort((a, b) => b.count - a.count || byCode(a, b));

  const pairs: PartyPair[] = pairRows.map((p) => ({
    from: p.from,
    to: p.to,
    count: num(p.n),
    first: p.first,
    last: p.last,
  }));
  const allCorrespondents = foldCorrespondents(pairs, user);

  const geo: GeoRoute[] = [];
  for (const g of geoRows) {
    const fromGeo = parseLatLng(g.fromGeo);
    const toGeo = parseLatLng(g.toGeo);
    if (!fromGeo && !toGeo) continue;
    geo.push({ id: g.id, title: g.title, from: g.from, to: g.to, fromGeo, toGeo, date: g.date });
  }

  const records = pick(latestIds);
  const byType: Record<string, DashboardRecord[]> = {};
  for (const r of pick(perTypeIds)) (byType[r.type.code] ??= []).push(r);
  return {
    total: num(total),
    createdCount: num(created),
    assignedCount: num(assigned),
    records,
    truncated: num(total) > records.length,
    byType,
    countsByType,
    range: { earliest, latest },
    byYear: fillYears(yearRows.map((y) => ({ year: y.year, count: num(y.count) }))),
    correspondents: allCorrespondents.slice(0, DASHBOARD_CORRESPONDENTS_LIMIT),
    correspondentCount: allCorrespondents.length,
    projects: projectCounts,
    money,
    recent: pick(recentIds),
    upcoming: pick(upcomingIds),
    geo,
  };
}
