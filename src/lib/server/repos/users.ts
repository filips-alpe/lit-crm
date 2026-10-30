import { prisma } from '$lib/prisma';
import type { UserOption } from '$lib/forms/recordOptions';

const userOptionSelect = {
  id: true,
  name: true,
  username: true,
  color: true,
  avatarSeed: true,
} as const;

/** Active users matching `q` (name or username, case-insensitive) for a `user`
 *  relation picker, ordered by name and capped at `limit`. */
export async function searchUserOptions(
  options: { q?: string; limit?: number } = {},
): Promise<UserOption[]> {
  const q = options.q?.trim();
  return prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: options.limit ?? 20,
    select: userOptionSelect,
  });
}

/** The users with exactly these ids (any status), so a form can label the
 *  values it already holds without shipping the whole user list. */
export async function resolveUserOptions(ids: string[]): Promise<UserOption[]> {
  if (ids.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: ids } },
    orderBy: { name: 'asc' },
    select: userOptionSelect,
  });
}
