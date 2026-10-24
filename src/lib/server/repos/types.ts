import { Prisma } from '../../../../generated/prisma/client';
import { prisma } from '$lib/prisma';
import { FIELD_TYPES } from '$lib/fields/registry';

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

// Record columns a layout field can map to: the union over every kind.
const LAYOUT_COLUMNS = [...new Set(Object.values(FIELD_TYPES).flatMap((t) => t.columns))];
const TEXT_COLUMNS = new Set([
  'note',
  'title',
  'description',
  'text',
  'unit',
  'from',
  'to',
  'fromGeo',
  'toGeo',
]);

/** How many of this type's records hold a non-null, non-empty value in each
 *  column a layout field can map to. The type editor uses it to warn before a
 *  layout change would hide data. Columns nobody filled count 0. */
export async function countRecordsWithData(typeId: string): Promise<Record<string, number>> {
  // One scan with a FILTER aggregate per column. Column names come from the
  // fixed FIELD_TYPES registry (identifiers can't be bound parameters); the
  // type id is a bound parameter.
  const filled = (col: string) => {
    const id = Prisma.raw(`"${col}"`);
    if (col === 'references') return Prisma.sql`COALESCE(cardinality(${id}), 0) > 0`;
    if (TEXT_COLUMNS.has(col)) return Prisma.sql`${id} IS NOT NULL AND ${id} <> ''`;
    return Prisma.sql`${id} IS NOT NULL`;
  };
  const selects = LAYOUT_COLUMNS.map(
    (col, i) => Prisma.sql`COUNT(*) FILTER (WHERE ${filled(col)}) AS ${Prisma.raw(`c${i}`)}`,
  );
  const [row] = await prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT ${Prisma.join(selects)} FROM "lit_record" WHERE "typeId" = ${typeId}`;
  return Object.fromEntries(LAYOUT_COLUMNS.map((col, i) => [col, Number(row[`c${i}`])]));
}
