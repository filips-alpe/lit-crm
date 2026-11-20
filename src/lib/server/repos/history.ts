import { prisma } from '$lib/prisma';
import type { HistoryEntry, HistoryPage } from '$lib/history/types';

/** The door's default page; it caps at 200 itself. */
export const HISTORY_PAGE_SIZE = 50;

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
 * `beforeId` is the cursor: the `nextBefore` of the previous page. `nextBefore` is set
 * whenever the page came back full (the door filters before it limits, so a full page is
 * the only sign there may be more); the last page may then be empty.
 */
export async function listRecordHistory(
  recordId: string,
  opts: { beforeId?: string | null; limit?: number } = {},
): Promise<HistoryPage> {
  const limit = opts.limit ?? HISTORY_PAGE_SIZE;
  const before = opts.beforeId && /^\d+$/.test(opts.beforeId) ? opts.beforeId : null;
  const rows = await prisma.$queryRaw<DoorRow[]>`
    SELECT * FROM lit_record_history(${recordId}, ${before}::bigint, ${limit}::int)`;

  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const projectIds = [
    ...new Set(
      rows
        .filter((r) => r.tableName === 'lit_project_record')
        .map((r) => r.data?.projectId)
        .filter((x): x is string => typeof x === 'string'),
    ),
  ];
  const [actors, projects] = await Promise.all([
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
  ]);
  const actorName = new Map(actors.map((u) => [u.id, u.name]));
  const projectCode = new Map(projects.map((p) => [p.id, p.code]));

  const entries = rows.map((r): HistoryEntry => {
    const link = r.tableName === 'lit_project_record';
    const changed = r.changed ?? [];
    const projectId = link && typeof r.data?.projectId === 'string' ? r.data.projectId : null;
    return {
      id: String(r.id),
      at: r.createdAt.toISOString(),
      kind: link ? 'link' : 'record',
      action: r.action,
      actorName: r.actorId ? (actorName.get(r.actorId) ?? null) : null,
      changed,
      values:
        r.action === 'UPDATE' && r.data
          ? Object.fromEntries(changed.filter((c) => c in r.data!).map((c) => [c, r.data![c]]))
          : {},
      projectCode: projectId ? (projectCode.get(projectId) ?? projectId) : null,
    };
  });
  return {
    entries,
    nextBefore: entries.length >= limit ? entries[entries.length - 1].id : null,
  };
}
