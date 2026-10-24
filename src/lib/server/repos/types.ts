import { prisma } from '$lib/prisma';

export class DuplicateCodeError extends Error {
  constructor(code: string) {
    super(`Type with code "${code}" already exists`);
    this.name = 'DuplicateCodeError';
  }
}

export async function getTypeById(id: string) {
  return prisma.type.findUnique({ where: { id } });
}

export type SaveTypeResult =
  | { kind: 'created'; row: Awaited<ReturnType<typeof addType>> }
  | { kind: 'updated'; row: NonNullable<Awaited<ReturnType<typeof updateType>>> }
  | { kind: 'not-found' };

export async function saveType(input: SaveTypeInput): Promise<SaveTypeResult> {
  const { id, ...data } = input;
  if (!id) {
    const row = await addType(data);
    return { kind: 'created', row };
  }
  const row = await updateType(id, data);
  return row ? { kind: 'updated', row } : { kind: 'not-found' };
}

export async function listTypes() {
  return prisma.type.findMany({ orderBy: [{ status: 'asc' }, { code: 'asc' }] });
}

export async function listTypesByLastUsed() {
  const rows = await prisma.type.findMany({
    where: { status: 'ACTIVE' },
    include: {
      records: {
        where: { status: 'ACTIVE' },
        orderBy: { date: { sort: 'desc', nulls: 'last' } },
        take: 1,
        select: { date: true },
      },
    },
  });
  return rows
    .map(({ records, ...rest }) => ({ ...rest, lastUsedAt: records[0]?.date ?? null }))
    .sort((a, b) => {
      if (a.lastUsedAt === null && b.lastUsedAt === null) return a.code.localeCompare(b.code);
      if (a.lastUsedAt === null) return -1;
      if (b.lastUsedAt === null) return 1;
      return a.lastUsedAt.getTime() - b.lastUsedAt.getTime();
    });
}

export async function softDeleteType(id: string) {
  return setStatus(id, 'INACTIVE');
}

export async function restoreType(id: string) {
  return setStatus(id, 'ACTIVE');
}

export type PermanentDeleteResult =
  | { kind: 'deleted' }
  | { kind: 'not-found' }
  | { kind: 'has-records'; recordCount: number };

export async function permanentlyDeleteType(id: string): Promise<PermanentDeleteResult> {
  const recordCount = await prisma.record.count({ where: { typeId: id } });
  if (recordCount > 0) return { kind: 'has-records', recordCount };
  try {
    await prisma.type.delete({ where: { id } });
    return { kind: 'deleted' };
  } catch (e) {
    if (isNotFound(e)) return { kind: 'not-found' };
    // A record raced in after the count above.
    if (isForeignKeyViolation(e)) {
      return {
        kind: 'has-records',
        recordCount: await prisma.record.count({ where: { typeId: id } }),
      };
    }
    throw e;
  }
}

async function setStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
  try {
    return await prisma.type.update({ where: { id }, data: { status } });
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

export interface UpdateTypeInput {
  code?: string;
  description?: string | null;
  color?: string;
  iconSeed?: string | null;
  layout?: unknown;
  /** Id of an installed renderer (registry), or null for the default rendering. */
  rendererId?: string | null;
}

export type AddTypeInput = UpdateTypeInput & { code: string };
export type SaveTypeInput = AddTypeInput & { id: string };

function normalizeRendererId(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export async function updateType(id: string, input: UpdateTypeInput) {
  try {
    return await prisma.type.update({
      where: { id },
      // Prisma ignores undefined fields, so unset inputs leave the column untouched.
      data: {
        code: input.code,
        description: input.description,
        color: input.color,
        iconSeed: input.iconSeed,
        layout: input.layout as never,
        rendererId:
          input.rendererId === undefined ? undefined : normalizeRendererId(input.rendererId),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DuplicateCodeError(input.code ?? '');
    if (isNotFound(e)) return null;
    throw e;
  }
}

export async function addType(input: AddTypeInput) {
  try {
    return await prisma.type.create({
      data: {
        code: input.code,
        description: input.description ?? null,
        layout: (input.layout ?? null) as never,
        rendererId: normalizeRendererId(input.rendererId),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.iconSeed !== undefined && { iconSeed: input.iconSeed }),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DuplicateCodeError(input.code);
    throw e;
  }
}

function prismaCode(e: unknown): unknown {
  return (e as { code?: unknown } | null)?.code;
}

function isUniqueViolation(e: unknown): boolean {
  return prismaCode(e) === 'P2002';
}

function isForeignKeyViolation(e: unknown): boolean {
  return prismaCode(e) === 'P2003';
}

function isNotFound(e: unknown): boolean {
  return prismaCode(e) === 'P2025';
}
