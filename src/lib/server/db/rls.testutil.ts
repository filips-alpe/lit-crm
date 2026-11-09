import { prismaOwner } from '$lib/prisma';

/**
 * A small world for tests that exercise the app under row-level security. Everything is
 * created through the OWNER connection (fixtures bypass the policies); the code under test
 * runs through the scoped `prisma` inside runAs().
 *
 *   admin    admin
 *   alice    creates R1 (amounts 100/2h/120) and the project P (R1 is in P); owns hidden Rh
 *   bob      creates R2 (amounts 50); no access to R1
 *   dora     no records; reaches R2 through a READ grant that hides amounts
 *   gone     inactive
 */
export async function makeWorld() {
  const user = (
    username: string,
    extra: { isAdmin?: boolean; status?: 'ACTIVE' | 'INACTIVE' } = {},
  ) => prismaOwner.user.create({ data: { username, name: username.toUpperCase(), ...extra } });
  const [admin, alice, bob, dora, gone] = await Promise.all([
    user('admin', { isAdmin: true }),
    user('alice'),
    user('bob'),
    user('dora'),
    user('gone', { status: 'INACTIVE' }),
  ]);
  const type = await prismaOwner.type.create({
    data: {
      code: 'note',
      layout: {
        fields: [
          { id: 'title', label: 'Title', kind: 'text', writeTo: 'title' },
          { id: 'sum', label: 'Sum', kind: 'number', writeTo: 'sum' },
        ],
      },
    },
  });
  const project = await prismaOwner.project.create({ data: { code: 'P', creatorId: alice.id } });
  const rec = (data: Record<string, unknown>) =>
    prismaOwner.record.create({ data: { typeId: type.id, ...data } as never });
  const r1 = await rec({ title: 'R1', creatorId: alice.id, sum: 100, hours: 2, total: 120 });
  const r2 = await rec({ title: 'R2', creatorId: bob.id, sum: 50, total: 55 });
  const rh = await rec({ title: 'Rh', creatorId: alice.id, hidden: true, sum: 1 });
  await prismaOwner.projectRecord.create({ data: { projectId: project.id, recordId: r1.id } });
  await prismaOwner.grant.create({
    data: { userId: dora.id, recordId: r2.id, level: 'READ', hideAmounts: true },
  });
  return { admin, alice, bob, dora, gone, type, project, r1, r2, rh };
}

export type World = Awaited<ReturnType<typeof makeWorld>>;
