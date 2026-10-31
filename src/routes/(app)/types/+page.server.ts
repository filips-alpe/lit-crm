import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listTypes, softDeleteType } from '$lib/server/repos/types';
import { requireUser } from '$lib/server/auth/requireUser';
import * as m from '$lib/paraglide/messages.js';

export const load: PageServerLoad = async (event) => {
  requireUser(event);
  return { rows: await listTypes() };
};

export const actions: Actions = {
  // Row-level soft delete; the page stays on the list, which reloads with the row
  // marked deleted. Restore and permanent delete live on /types/[id].
  delete: async (event) => {
    requireUser(event);
    const id = (await event.request.formData()).get('id');
    const row = typeof id === 'string' && id ? await softDeleteType(id) : null;
    if (!row) return fail(404, { error: m.pink_kind_loris_believe() });
    return { deleted: row.id };
  },
};
