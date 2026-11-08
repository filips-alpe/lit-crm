import { prisma } from '$lib/prisma';
import { asForbidden, ForbiddenError } from '$lib/server/db/errors';
import type { GrantLevel, UserStatus } from '../../../../generated/prisma/enums';

/** Everything the admin screen reads and writes. All of it runs as the signed-in admin
 *  under row-level security: the database refuses every one of these writes for anyone
 *  else, so the route guard is a courtesy, not the protection. */

export class LastAdminError extends Error {
  constructor() {
    super('at least one active admin is required');
    this.name = 'LastAdminError';
  }
}
export class NotFoundError extends Error {
  constructor() {
    super('not found');
    this.name = 'NotFoundError';
  }
}
export class DuplicateNameError extends Error {
  constructor() {
    super('name taken');
    this.name = 'DuplicateNameError';
  }
}
export class InvalidGrantError extends Error {
  constructor() {
    super('invalid grant');
    this.name = 'InvalidGrantError';
  }
}

const code = (e: unknown): unknown => (e as { code?: unknown } | null)?.code;
const text = (e: unknown) =>
  JSON.stringify(e, Object.getOwnPropertyNames((e as object) ?? {})) + String(e);

/** Run a write, turning the database's refusals into typed errors. */
async function write<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof LastAdminError) throw e;
    if (code(e) === 'P2002') throw new DuplicateNameError();
    if (code(e) === 'P2003' || /23503|23514|check constraint/i.test(text(e)))
      throw new InvalidGrantError();
    if (code(e) === 'P2025') throw new NotFoundError();
    if (asForbidden(e)) throw new ForbiddenError();
    throw e;
  }
}

// ---------- users ----------

export function listAdminUsers() {
  return prisma.user.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, username: true, name: true, status: true, isAdmin: true },
  });
}

/** Set a user's admin flag and status. Refuses to leave the system without an active admin. */
export async function updateUserAccess(
  id: string,
  input: { isAdmin: boolean; status: UserStatus },
) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError();
  const losesAdmin =
    target.isAdmin && target.status === 'ACTIVE' && (!input.isAdmin || input.status !== 'ACTIVE');
  if (losesAdmin) {
    const others = await prisma.user.count({
      where: { id: { not: id }, isAdmin: true, status: 'ACTIVE' },
    });
    if (others === 0) throw new LastAdminError();
  }
  return write(() =>
    prisma.user.update({
      where: { id },
      data: { isAdmin: input.isAdmin, status: input.status },
      select: { id: true, isAdmin: true, status: true },
    }),
  );
}

// ---------- groups and memberships ----------

export function listGroups() {
  return prisma.group.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
        select: { userId: true, user: { select: { id: true, username: true, name: true } } },
      },
    },
  });
}

export const createGroup = (input: { name: string; description: string | null }) =>
  write(() => prisma.group.create({ data: input }));

export const updateGroup = (id: string, input: { name: string; description: string | null }) =>
  write(() => prisma.group.update({ where: { id }, data: input }));

export const deleteGroup = (id: string) => write(() => prisma.group.delete({ where: { id } }));

export const addMember = (groupId: string, userId: string) =>
  write(() =>
    prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId },
      update: {},
    }),
  );

export const removeMember = (groupId: string, userId: string) =>
  write(() => prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } }));

// ---------- grants ----------

export type GrantTarget = { kind: 'user' | 'group'; id: string };
export type GrantScope = { kind: 'person' | 'project' | 'type' | 'record'; id: string };

export function listGrants() {
  return prisma.grant.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    include: {
      user: { select: { id: true, name: true, username: true } },
      group: { select: { id: true, name: true } },
      person: { select: { id: true, name: true, username: true } },
      project: { select: { id: true, code: true } },
      type: { select: { id: true, code: true } },
      record: { select: { id: true, title: true, note: true } },
    },
  });
}

export function createGrant(input: {
  target: GrantTarget;
  scope: GrantScope;
  level: GrantLevel;
  hideAmounts: boolean;
}) {
  if (!input.target.id || !input.scope.id) throw new InvalidGrantError();
  return write(() =>
    prisma.grant.create({
      data: {
        ...(input.target.kind === 'user'
          ? { userId: input.target.id }
          : { groupId: input.target.id }),
        ...(input.scope.kind === 'person' ? { personId: input.scope.id } : {}),
        ...(input.scope.kind === 'project' ? { projectId: input.scope.id } : {}),
        ...(input.scope.kind === 'type' ? { typeId: input.scope.id } : {}),
        ...(input.scope.kind === 'record' ? { recordId: input.scope.id } : {}),
        level: input.level,
        hideAmounts: input.hideAmounts,
      },
    }),
  );
}

export const updateGrant = (id: string, input: { level: GrantLevel; hideAmounts: boolean }) =>
  write(() => prisma.grant.update({ where: { id }, data: input }));

export const deleteGrant = (id: string) => write(() => prisma.grant.delete({ where: { id } }));

/** Choices for the grant form's pickers. */
export async function loadGrantChoices() {
  const [users, groups, projects, types] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, username: true },
    }),
    prisma.group.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.project.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true } }),
    prisma.type.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true } }),
  ]);
  return { users, groups, projects, types };
}
