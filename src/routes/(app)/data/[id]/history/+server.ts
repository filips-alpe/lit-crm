import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listRecordHistory } from '$lib/server/repos/history';

/**
 * Older history of one record: `GET /data/[id]/history?before=<cursor>`. Returns the same
 * `{ entries, nextBefore }` page the record page ships first; `before` is the `nextBefore` of
 * the page already shown. What the user may see is decided in the database.
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
  // A JSON endpoint: answer 401 rather than redirecting a fetch to the login page.
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const before = url.searchParams.get('before');
  // 19 digits can still overflow bigint, which Postgres would reject with a 500.
  if (before !== null && (!/^\d{1,19}$/.test(before) || BigInt(before) > 9223372036854775807n)) {
    return json({ error: 'invalid before' }, { status: 400 });
  }
  return json(await listRecordHistory(params.id, { beforeId: before }));
};
