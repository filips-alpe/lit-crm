import { prisma } from '$lib/prisma';
import type { HistoryEntry, HistoryPage } from '$lib/history/types';

/** The door's default page; it caps at 200 itself. */
export const HISTORY_PAGE_SIZE = 50;
/** One row more than a page is fetched to know whether anything older exists; the door caps at 200. */
const MAX_PAGE = 199;

/** Update columns that hold the id of another row, and what that id points at. */
const RELATION_COLUMNS = { creatorId: 'user', assigneeId: 'user', recordId: 'record' } as const;

type DoorRow = {
  id: bigint;
  createdAt: Date;
  tableName: string;
  action: HistoryEntry['action'];
  data: Record<string, unknown> | null;
  changed: string[] | null;
  actorId: string | null;
};

/**
 * One page of a record's history, newest first, through the database door
 * `lit_record_history`. Row-level security inside the door decides what the signed-in
 * user may see (readable record, allowed columns, masked amounts, no hidden period, no
 * REDACT rows for non-admins); this only reshapes the rows and resolves names.
 *
 * `beforeId` is the cursor: the `nextBefore` of the previous page. One row more than the
 * page is fetched: `nextBefore` is set only when that extra row exists, so "Load more" never
 * leads to an empty page.
 *
 * Relation ids in updated values (creator, assignee, linked record) are resolved to names
 * and titles with the same row-level-security-bound client; one the viewer cannot read
 * resolves to a null label (shown as "hidden record" or "unknown user"). Where `refs`
 * covers a column its raw id is dropped from `values`.
 */
export async function listRecordHistory(
  recordId: string,
  opts: { beforeId?: string | null; limit?: number } = {},
): Promise<HistoryPage> {
  const limit = Math.min(Math.max(opts.limit ?? HISTORY_PAGE_SIZE, 1), MAX_PAGE);
  const before = opts.beforeId && /^\d+$/.test(opts.beforeId) ? opts.beforeId : null;
  const fetched = await prisma.$queryRaw<DoorRow[]>`
    SELECT * FROM lit_record_history(${recordId}, ${before}::bigint, ${limit + 1}::int)`;
  const more = fetched.length > limit;
  const rows = fetched.slice(0, limit);

  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const projectIds = [
    ...new Set(
      rows
        .filter((r) => r.tableName === 'lit_project_record')
        .map((r) => r.data?.projectId)
        .filter((x): x is string => typeof x === 'string'),
    ),
  ];
  const updated = rows.filter((r) => r.action === 'UPDATE' && r.tableName !== 'lit_project_record');
  const refIds = (kind: 'user' | 'record') => [
    ...new Set(
      updated.flatMap((r) =>
        Object.entries(RELATION_COLUMNS)
          .filter(([col, k]) => k === kind && (r.changed ?? []).includes(col))
          .map(([col]) => r.data?.[col])
          .filter((x): x is string => typeof x === 'string'),
      ),
    ),
  ];
  const refUserIds = refIds('user');
  const refRecordIds = refIds('record');
  const [actors, projects, refUsers, refRecords] = await Promise.all([
    actorIds.length
      ? prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [],
    projectIds.length
      ? prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, code: true },
        })
      : [],
    refUserIds.length
      ? prisma.user.findMany({
          where: { id: { in: refUserIds } },
          select: { id: true, name: true },
        })
      : [],
    refRecordIds.length
      ? prisma.record.findMany({
          where: { id: { in: refRecordIds } },
          select: { id: true, title: true },
        })
      : [],
  ]);
  const refLabel = {
    user: new Map<string, string | null>(refUsers.map((u) => [u.id, u.name])),
    record: new Map<string, string | null>(refRecords.map((r) => [r.id, r.title])),
  };
  const actorName = new Map(actors.map((u) => [u.id, u.name]));
  const projectCode = new Map(projects.map((p) => [p.id, p.code]));

  const entries = rows.map((r): HistoryEntry => {
    const link = r.tableName === 'lit_project_record';
    const changed = r.changed ?? [];
    const values =
      r.action === 'UPDATE' && r.data
        ? Object.fromEntries(changed.filter((c) => c in r.data!).map((c) => [c, r.data![c]]))
        : {};
    const refs: HistoryEntry['refs'] = {};
    if (!link)
      for (const [col, kind] of Object.entries(RELATION_COLUMNS)) {
        const v = values[col];
        if (typeof v !== 'string') continue;
        const map = refLabel[kind];
        // Unreadable (or gone): null. A readable record without a title has an empty label.
        refs[col] = map.has(v) ? { kind, label: map.get(v) ?? '' } : { kind, label: null };
        // The raw id never leaves the server: the label (or null) is all the viewer gets.
        delete values[col];
      }
    const projectId = link && typeof r.data?.projectId === 'string' ? r.data.projectId : null;
    return {
      id: String(r.id),
      at: r.createdAt.toISOString(),
      kind: link ? 'link' : 'record',
      action: r.action,
      actorName: r.actorId ? (actorName.get(r.actorId) ?? null) : null,
      changed,
      values,
      refs,
      projectCode: projectId ? (projectCode.get(projectId) ?? projectId) : null,
    };
  });
  return {
    entries,
    nextBefore: more ? entries[entries.length - 1].id : null,
  };
}
