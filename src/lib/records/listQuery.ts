import { layoutSchema, type Layout } from '$lib/schemas/types';

/** The filter/sort params the `/data` list page and its `/data/records` JSON
 *  endpoint both read off the URL, parsed the same way so the two views of
 *  the list never drift apart. */
export interface RecordListQuery {
  page: number;
  includeDeleted: boolean;
  sort: 'old' | 'new';
  typeId: string | null;
  correspondent: string | null;
}

/** Highest page number honoured; anything beyond falls back to page 1. */
export const MAX_PAGE = 10_000;
/** Longest correspondent filter honoured (characters). */
export const MAX_CORRESPONDENT_LENGTH = 100;

function parsePage(raw: string | null): number {
  const page = Number(raw ?? '1');
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

export function parseRecordListQuery(url: URL): RecordListQuery {
  return {
    page: parsePage(url.searchParams.get('page')),
    includeDeleted: url.searchParams.get('deleted') === '1',
    sort: url.searchParams.get('sort') === 'old' ? 'old' : 'new',
    typeId: url.searchParams.get('type') || null,
    correspondent:
      url.searchParams.get('correspondent')?.trim().slice(0, MAX_CORRESPONDENT_LENGTH) || null,
  };
}

/** The `listRecords` options for a parsed query. `/data` overrides `typeId` with
 *  the id of the type row it actually found. */
export function listRecordsOptions(query: RecordListQuery, typeId: string | null = query.typeId) {
  return {
    page: query.page,
    includeDeleted: query.includeDeleted,
    sortBy: 'createdAt' as const,
    sortDir: query.sort === 'old' ? ('asc' as const) : ('desc' as const),
    typeId: typeId ?? undefined,
    correspondent: query.correspondent ?? undefined,
  };
}

/** The inverse of {@link parseRecordListQuery}: the query string that reproduces
 *  `query` (defaults omitted), used by the infinite-scroll fetch. */
export function recordListParams(query: RecordListQuery): URLSearchParams {
  const params = new URLSearchParams({ page: String(query.page) });
  if (query.includeDeleted) params.set('deleted', '1');
  if (query.sort === 'old') params.set('sort', 'old');
  if (query.typeId) params.set('type', query.typeId);
  if (query.correspondent) params.set('correspondent', query.correspondent);
  return params;
}

interface RecordRowWithType<TType> {
  type: TType;
  [key: string]: unknown;
}

/** Parse each row's type layout (raw JSON column) into a {@link Layout},
 *  falling back to `null` for a row whose layout fails to parse. */
export function projectRecordRows<
  T extends RecordRowWithType<TType>,
  TType extends { layout: unknown },
>(rows: T[]): Array<T & { type: Omit<TType, 'layout'> & { layout: Layout | null } }> {
  return rows.map((row) => {
    const parsed = layoutSchema.safeParse(row.type.layout);
    return {
      ...row,
      type: { ...row.type, layout: parsed.success ? parsed.data : null },
    };
  });
}
