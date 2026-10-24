import { prisma } from '$lib/prisma';
import { Prisma } from '../../../../generated/prisma/client';
import { layoutSchema, recipientColumn } from '$lib/schemas/types';
import { FIELD_TYPES } from '$lib/fields/registry';
import type { RecordOption } from '$lib/forms/recordOptions';

// Prisma returns `sum` / `total` as Decimal instances, which SvelteKit cannot
// serialize across the load boundary. Coerce them to plain numbers so every
// consumer gets a POJO.
const DECIMAL_COLUMNS = ['sum', 'total'] as const;

function plainRecord<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const col of DECIMAL_COLUMNS) {
    const value = out[col];
    out[col] = value == null ? null : Number(value);
  }
  return out as T;
}

const person = {
  select: { id: true, username: true, name: true, color: true, avatarSeed: true },
} as const;

// Shared include so list/detail return the same type + creator projection.
export const recordInclude = {
  type: {
    select: {
      id: true,
      code: true,
      color: true,
      iconSeed: true,
      layout: true,
      rendererId: true,
    },
  },
  creator: person,
  assignee: person,
  // The linked record (self-relation) — just enough to label it in a relation chip.
  record: {
    select: { id: true, title: true, note: true },
  },
  // The universal project membership (many-to-many), for the project multiselect.
  projects: {
    select: { projectId: true, project: { select: { id: true, code: true, color: true } } },
  },
} as const;

/** Columns a record edit may write — the union of field-registry storage columns
 *  (see $lib/fields/registry). */
export interface UpdateRecordInput {
  creatorId?: string | null;
  assigneeId?: string | null;
  recordId?: string | null;
  projectIds?: string[];
  note?: string | null;
  references?: string[];
  sum?: number | null;
  hours?: number | null;
  total?: number | null;
  date?: Date | string | null;
  start?: Date | string | null;
  end?: Date | string | null;
  title?: string | null;
  description?: string | null;
  text?: string | null;
  unit?: string | null;
  from?: string | null;
  to?: string | null;
  fromGeo?: string | null;
  toGeo?: string | null;
}

// Derived from the field registry so a column a kind allows can never be
// silently dropped here. Relation foreign keys have dedicated handling.
const RELATION_COLUMNS = new Set<string>([
  ...FIELD_TYPES.user.columns,
  ...FIELD_TYPES.record.columns,
]);
const DATE_COLUMNS: readonly string[] = FIELD_TYPES.date.columns;

/** The scalar record columns a client-built input may write. Writes are built
 *  from the field registry's columns (never by spreading the input), so a crafted
 *  layout can't reach status, ids, timestamps or foreign keys through a free-form
 *  `writeTo`. */
const WRITABLE_COLUMNS: readonly string[] = [
  ...new Set(Object.values(FIELD_TYPES).flatMap((t) => t.columns)),
].filter((c) => !RELATION_COLUMNS.has(c));

/** Thrown when a date column is given a string that doesn't parse as a date. */
export class InvalidDateError extends Error {
  constructor(
    readonly column: string,
    readonly value: unknown,
  ) {
    super(`Invalid date for "${column}": ${String(value)}`);
    this.name = 'InvalidDateError';
  }
}

function toDate(column: string, value: unknown): Date {
  const date = new Date(value as Date | string);
  if (Number.isNaN(date.getTime())) throw new InvalidDateError(column, value);
  return date;
}

function writableColumns(input: UpdateRecordInput) {
  const data: Record<string, unknown> = {};
  const source = input as Record<string, unknown>;
  for (const col of WRITABLE_COLUMNS) {
    const value = source[col];
    if (value === undefined) continue;
    // Date columns take a Date (null clears).
    data[col] = DATE_COLUMNS.includes(col) ? (value ? toDate(col, value) : null) : value;
  }
  return data;
}

export type CreateRecordInput = UpdateRecordInput & { typeId: string };

export interface ListRecordsOptions {
  page?: number;
  pageSize?: number;
  sortDir?: 'asc' | 'desc';
  includeDeleted?: boolean;
  typeId?: string;
  /** Filter to records whose recipient contains this text (case-insensitive). The
   *  recipient is the column each record's type designates via its layout — `to`
   *  for letters/invoices, `from` for payments received. */
  correspondent?: string;
}

const DEFAULT_PAGE_SIZE = 25;

// Group type ids by the column their layout designates as the recipient, so the
// correspondent filter can target each record's own recipient field.
async function recipientColumnsByType(): Promise<{ to: string[]; from: string[] }> {
  const types = await prisma.type.findMany({ select: { id: true, layout: true } });
  const to: string[] = [];
  const from: string[] = [];
  for (const t of types) {
    const parsed = layoutSchema.safeParse(t.layout);
    const col = parsed.success ? recipientColumn(parsed.data) : null;
    if (col === 'to') to.push(t.id);
    else if (col === 'from') from.push(t.id);
  }
  return { to, from };
}

// Build the WHERE that both the list and its neighbor lookups share, so a record's
// prev/next can never drift from the list the user is browsing.
async function buildRecordWhere(options: ListRecordsOptions): Promise<Record<string, unknown>> {
  const where: Record<string, unknown> = {};
  if (!options.includeDeleted) where.status = 'ACTIVE';
  if (options.typeId) where.typeId = options.typeId;
  const correspondent = options.correspondent?.trim();
  if (correspondent) {
    const { to, from } = await recipientColumnsByType();
    const match = { contains: correspondent, mode: 'insensitive' as const };
    const clauses: Record<string, unknown>[] = [];
    if (to.length) clauses.push({ typeId: { in: to }, to: match });
    if (from.length) clauses.push({ typeId: { in: from }, from: match });
    // No recipient-bearing types → match nothing rather than everything.
    where.OR = clauses.length ? clauses : [{ id: '' }];
  }
  return where;
}

export async function listRecords(options: ListRecordsOptions = {}) {
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const sortDir = options.sortDir ?? 'desc';

  const where = await buildRecordWhere(options);

  // Secondary id sort breaks createdAt ties deterministically — the same
  // tiebreak getRecordNeighbors uses, so neighbors line up with the list.
  const orderBy = [{ createdAt: sortDir }, { id: sortDir }];

  const [rows, total] = await Promise.all([
    prisma.record.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: recordInclude,
    }),
    prisma.record.count({ where }),
  ]);
  return { rows: rows.map(plainRecord), total, page, pageSize };
}

const OPTION_LABEL_MAX = 120;

type OptionLabelRow = {
  id: string;
  title: string | null;
  note: string | null;
  date: Date | null;
  createdAt: Date;
  type: { code: string };
};

const OPTION_SELECT = {
  id: true,
  title: true,
  note: true,
  date: true,
  createdAt: true,
  type: { select: { code: true } },
} as const;

/** Picker label: the title, else the note, else "<type code> · <YYYY-MM-DD>"
 *  (the record's date, else its creation date) so untitled records stay
 *  recognisable and findable by type code. */
function recordOptionLabel(r: OptionLabelRow): string {
  const label =
    r.title ?? r.note ?? `${r.type.code} · ${(r.date ?? r.createdAt).toISOString().slice(0, 10)}`;
  return label.length > OPTION_LABEL_MAX ? `${label.slice(0, OPTION_LABEL_MAX)}…` : label;
}

const TEXT_SEARCH_MIN = 3;

/** Active records matching `q` (title, note, type code, and — for queries of at
 *  least `TEXT_SEARCH_MIN` characters — text; case-insensitive)
 *  for a `record` relation picker — id + a short label (see `recordOptionLabel`).
 *  Optionally excludes one id so a record can't link to itself. Newest first,
 *  capped at `limit`. */
export async function searchRecordOptions(
  options: { q?: string; limit?: number; excludeId?: string } = {},
): Promise<RecordOption[]> {
  const q = options.q?.trim();
  const rows = await prisma.record.findMany({
    where: {
      status: 'ACTIVE',
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { note: { contains: q, mode: 'insensitive' } },
              // `text` is unindexed and can be book-length: only scan it once
              // the query is specific enough to be worth it.
              ...(q.length >= TEXT_SEARCH_MIN
                ? [{ text: { contains: q, mode: 'insensitive' as const } }]
                : []),
              { type: { code: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: options.limit ?? 20,
    select: OPTION_SELECT,
  });
  return rows.map((r) => ({ id: r.id, label: recordOptionLabel(r) }));
}

/** The records with exactly these ids (any status), so a form can label the
 *  values it already holds without shipping the whole record list. */
export async function resolveRecordOptions(ids: string[]): Promise<RecordOption[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.record.findMany({
    where: { id: { in: ids } },
    select: OPTION_SELECT,
  });
  return rows.map((r) => ({ id: r.id, label: recordOptionLabel(r) }));
}

export async function getRecordById(id: string) {
  const row = await prisma.record.findUnique({ where: { id }, include: recordInclude });
  return row ? plainRecord(row) : null;
}

export interface CorrespondenceThread {
  prevId: string | null;
  nextId: string | null;
  /** 1-based position of the current letter in the thread (0 if not found). */
  position: number;
  /** Total letters in the thread. */
  total: number;
}

// The characters JS `String.prototype.trim()` strips, for Postgres' btrim().
const TRIM_CHARS =
  '\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

/**
 * The correspondence a letter belongs to: every record of the same type whose
 * {from, to} matches this letter's two endpoints in either direction (the stack
 * of letters between the same two people), ordered by entry time. Returns the
 * previous/next letter ids plus this letter's position and the thread size.
 *
 * Endpoints are matched trimmed + case-insensitively, entirely in the database
 * (`lower(btrim(...))` on both sides), so there is a single definition of
 * equality — no JS/Postgres case-folding disagreement (e.g. "İ", "ß") that a
 * prefilter-then-recheck could turn into a missed match.
 */
export async function getCorrespondenceNeighbors(options: {
  id: string;
  from: string;
  to: string;
  typeId: string;
  includeDeleted?: boolean;
}): Promise<CorrespondenceThread> {
  if (!options.from.trim() || !options.to.trim()) {
    return { prevId: null, nextId: null, position: 0, total: 0 };
  }

  const statusFilter = options.includeDeleted ? Prisma.empty : Prisma.sql`AND "status" = 'ACTIVE'`;
  // Both the columns and the bound endpoints are normalised by the same SQL
  // expression, trimming the same set as JS `String.trim()` (NBSP and other
  // Unicode spaces included) so a record always matches its own thread.
  const norm = (value: Prisma.Sql) => Prisma.sql`lower(btrim(${value}, ${TRIM_CHARS}))`;
  const from = norm(Prisma.raw('"from"'));
  const to = norm(Prisma.raw('"to"'));
  const a = norm(Prisma.sql`${options.from}`);
  const b = norm(Prisma.sql`${options.to}`);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "lit_record"
    WHERE "typeId" = ${options.typeId} ${statusFilter}
      AND (
        (${from} = ${a} AND ${to} = ${b})
        OR (${from} = ${b} AND ${to} = ${a})
      )
    ORDER BY "createdAt" ASC, "id" ASC`;

  const i = rows.findIndex((r) => r.id === options.id);
  if (i === -1) return { prevId: null, nextId: null, position: 0, total: rows.length };
  return {
    prevId: rows[i - 1]?.id ?? null,
    nextId: rows[i + 1]?.id ?? null,
    position: i + 1,
    total: rows.length,
  };
}

/** A letter reduced to what the correspondence map needs: its id, endpoints
 *  (names + geo strings) and subject. Geo is left as the raw "lat,lng" string so
 *  the renderer parses it with the same {@link parseLatLng} the live form uses. */
export interface CorrespondenceMapLetter {
  id: string;
  from: string | null;
  to: string | null;
  fromGeo: string | null;
  toGeo: string | null;
  title: string | null;
}

/**
 * Every letter of a type that can be plotted — i.e. has at least one geo
 * endpoint — for the detail view's correspondence map. A lean projection (ids,
 * endpoints, geo, subject) ordered deterministically by entry time, so the
 * current letter can be drawn highlighted among the rest of the correspondence.
 */
export async function listCorrespondenceMap(options: {
  typeId: string;
  includeDeleted?: boolean;
}): Promise<CorrespondenceMapLetter[]> {
  const filters: Record<string, unknown>[] = [
    { typeId: options.typeId },
    { OR: [{ fromGeo: { not: null } }, { toGeo: { not: null } }] },
  ];
  if (!options.includeDeleted) filters.push({ status: 'ACTIVE' });

  return prisma.record.findMany({
    where: { AND: filters },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, from: true, to: true, fromGeo: true, toGeo: true, title: true },
  });
}

// A project membership for a nested join write: connect the project, create the
// join row.
function projectLinks(projectIds: string[]) {
  return [...new Set(projectIds)].map((id) => ({ project: { connect: { id } } }));
}

/** Per-field relation problems from {@link validateRecordRelations}: either the
 *  referenced row doesn't exist (or is inactive), or — for `recordId` only — it
 *  points at the record itself. */
export type RecordRelationErrors = Partial<
  Record<'creatorId' | 'assigneeId' | 'recordId' | 'projectIds', 'notFound' | 'self'>
>;

/**
 * Check that every relation id a record form submits (creator/assignee users,
 * linked record, projects) actually resolves to an active row, before the write reaches
 * Prisma — an unchecked id otherwise 500s at the `connect`. One query per
 * related model. `currentId` (update only) also rejects a record linking to
 * itself.
 */
export async function validateRecordRelations(
  input: {
    creatorId?: string | null;
    assigneeId?: string | null;
    recordId?: string | null;
    projectIds?: string[] | null;
  },
  options: { currentId?: string } = {},
): Promise<RecordRelationErrors | null> {
  const errors: RecordRelationErrors = {};

  const userIds = [input.creatorId, input.assigneeId].filter((v): v is string => !!v);
  if (userIds.length) {
    const found = await prisma.user.findMany({
      where: { id: { in: userIds }, status: 'ACTIVE' },
      select: { id: true },
    });
    const foundIds = new Set(found.map((u) => u.id));
    if (input.creatorId && !foundIds.has(input.creatorId)) errors.creatorId = 'notFound';
    if (input.assigneeId && !foundIds.has(input.assigneeId)) errors.assigneeId = 'notFound';
  }

  if (input.recordId) {
    if (options.currentId && input.recordId === options.currentId) {
      errors.recordId = 'self';
    } else {
      const found = await prisma.record.findFirst({
        where: { id: input.recordId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!found) errors.recordId = 'notFound';
    }
  }

  const projectIds = [...new Set(input.projectIds ?? [])];
  if (projectIds.length) {
    const count = await prisma.project.count({
      where: { id: { in: projectIds }, status: 'ACTIVE' },
    });
    if (count !== projectIds.length) errors.projectIds = 'notFound';
  }

  return Object.keys(errors).length ? errors : null;
}

export async function createRecord(input: CreateRecordInput) {
  const { typeId, creatorId, assigneeId, recordId, projectIds } = input;
  // `type: { connect }` forces Prisma's checked create input, so every relation
  // FK must use the connect form (scalar `assigneeId`/`recordId` are rejected there).
  const created = await prisma.record.create({
    data: {
      type: { connect: { id: typeId } },
      ...(creatorId ? { creator: { connect: { id: creatorId } } } : {}),
      ...(assigneeId ? { assignee: { connect: { id: assigneeId } } } : {}),
      ...(recordId ? { record: { connect: { id: recordId } } } : {}),
      ...(projectIds?.length ? { projects: { create: projectLinks(projectIds) } } : {}),
      ...writableColumns(input),
    },
  });
  return plainRecord(created);
}

export async function updateRecord(id: string, input: UpdateRecordInput) {
  const { projectIds, creatorId, assigneeId, recordId } = input;
  const updated = await prisma.record.update({
    where: { id },
    data: {
      // A provided list replaces the membership wholesale (clear, then re-link).
      ...(projectIds !== undefined
        ? { projects: { deleteMany: {}, create: projectLinks(projectIds) } }
        : {}),
      // Relation FKs are written as scalars on update (null clears the link).
      ...(creatorId !== undefined ? { creatorId } : {}),
      ...(assigneeId !== undefined ? { assigneeId } : {}),
      ...(recordId !== undefined ? { recordId } : {}),
      ...writableColumns(input),
    },
  });
  return plainRecord(updated);
}
