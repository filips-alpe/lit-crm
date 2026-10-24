import type { PageServerLoad } from './$types';
import { listTypes } from '$lib/server/repos/types';
import { requireUser } from '$lib/server/auth/requireUser';

export const load: PageServerLoad = async (event) => {
  requireUser(event);
  return { rows: await listTypes() };
};
