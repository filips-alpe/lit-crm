import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';
import { listRecords } from '$lib/server/repos/records';
import { getTypeById, listTypes } from '$lib/server/repos/types';
import {
  listRecordsOptions,
  parseRecordListQuery,
  projectRecordRows,
} from '$lib/records/listQuery';

export const load: PageServerLoad = async (event) => {
  requireUser(event);
  const { url } = event;
  const query = parseRecordListQuery(url);
  const { includeDeleted, sort, typeId, correspondent } = query;
  const view = url.searchParams.get('view') === 'grid' ? 'grid' : 'list';

  const [typeRow, allTypes] = await Promise.all([
    typeId ? getTypeById(typeId) : Promise.resolve(null),
    listTypes(),
  ]);

  const result = await listRecords(listRecordsOptions(query, typeRow?.id ?? null));

  const rows = projectRecordRows(result.rows);

  const typeFilter = typeRow
    ? { id: typeRow.id, code: typeRow.code, color: typeRow.color, iconSeed: typeRow.iconSeed }
    : null;

  const typeOptions = allTypes.map((t) => ({
    id: t.id,
    code: t.code,
    description: t.description,
    color: t.color,
    iconSeed: t.iconSeed,
    status: t.status,
  }));

  return {
    ...result,
    rows,
    includeDeleted,
    view,
    sort,
    typeFilter,
    typeOptions,
    correspondentFilter: correspondent,
  };
};
