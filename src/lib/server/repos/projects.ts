import { prisma } from '$lib/prisma';
import type { ProjectOption } from '$lib/forms/recordOptions';

/** Active projects for the universal project multiselect — id/code/color,
 *  ordered by code. */
export async function listProjectOptions(): Promise<ProjectOption[]> {
  return prisma.project.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, color: true },
  });
}
