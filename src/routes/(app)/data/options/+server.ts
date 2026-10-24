import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchRecordOptions } from '$lib/server/repos/records';
import { searchUserOptions } from '$lib/server/repos/users';

// Module-local: a +server.ts may only export request handlers and route config.
const OPTIONS_MAX_LIMIT = 20;
const OPTIONS_MAX_QUERY = 100;

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, OPTIONS_MAX_LIMIT) : OPTIONS_MAX_LIMIT;
}

/**
 * Relation-picker search: `GET /data/options?kind=user|record&q=&limit=&exclude=`.
 * Returns `{ options }` — at most 20 active items; `exclude` omits one record id
 * (the record being edited) so it cannot link to itself.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  // A JSON endpoint: answer 401 rather than redirecting a fetch to the login page.
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });

  const kind = url.searchParams.get('kind');
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, OPTIONS_MAX_QUERY);
  const limit = parseLimit(url.searchParams.get('limit'));

  if (kind === 'user') return json({ options: await searchUserOptions({ q, limit }) });
  if (kind === 'record') {
    const excludeId = url.searchParams.get('exclude') || undefined;
    return json({ options: await searchRecordOptions({ q, limit, excludeId }) });
  }
  return json({ error: 'invalid kind' }, { status: 400 });
};
