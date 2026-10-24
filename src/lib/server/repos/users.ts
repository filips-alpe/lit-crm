import { prisma } from '$lib/prisma';
import type { UserOption } from '$lib/forms/recordOptions';

/** Active users for a `user` relation picker — id + the bits a person chip needs
 *  (name, username, color, avatarSeed), ordered by name. */
export async function listUserOptions(): Promise<UserOption[]> {
  return prisma.user.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, username: true, color: true, avatarSeed: true },
  });
}
