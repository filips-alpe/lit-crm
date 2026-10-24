import { prisma } from '$lib/prisma';
import { recordInclude } from '$lib/server/repos/records';
import type { FormLayout } from '$lib/forms/layout';
import type { RawDashboardRecord } from '$lib/dashboards/aggregate';

/**
 * Every ACTIVE record the user created or was assigned, with the joins a
 * dashboard needs. `text` is left out (book-length on some records) and Decimal
 * columns are coerced to numbers so the result is serializable.
 */
export async function listRecordsForUser(userId: string): Promise<RawDashboardRecord[]> {
  const rows = await prisma.record.findMany({
    where: { status: 'ACTIVE', OR: [{ creatorId: userId }, { assigneeId: userId }] },
    omit: { text: true },
    include: {
      type: recordInclude.type,
      creator: recordInclude.creator,
      assignee: recordInclude.assignee,
      projects: recordInclude.projects,
    },
  });
  return rows.map((r) => ({
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
  }));
}
