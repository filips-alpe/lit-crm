import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listRecords } from '$lib/server/repos/records';
import {
  listRecordsOptions,
  parseRecordListQuery,
  projectRecordRows,
} from '$lib/records/listQuery';

export const GET: RequestHandler = async (event) => {
  // A JSON endpoint: answer 401 rather than redirecting a fetch to the login page.
  if (!event.locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const result = await listRecords(listRecordsOptions(parseRecordListQuery(event.url)));

  const rows = projectRecordRows(result.rows);

  return json({ rows, total: result.total, page: result.page, pageSize: result.pageSize });
};
