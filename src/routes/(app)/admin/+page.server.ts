import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth/requireUser';
import {
  LastAdminError,
  NotFoundError,
  listAdminUsers,
  updateUserAccess,
} from '$lib/server/repos/admin';
import { ForbiddenError } from '$lib/server/db/errors';
import * as m from '$lib/paraglide/messages.js';

export const load: PageServerLoad = async (event) => {
  requireAdmin(event, m.this_quaint_loris_cure());
  return { users: await listAdminUsers() };
};

export const actions: Actions = {
  save: async (event) => {
    requireAdmin(event, m.this_quaint_loris_cure());
    const data = await event.request.formData();
    const id = String(data.get('id') ?? '');
    const status = data.get('status') === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateUserAccess(id, { isAdmin: data.get('isAdmin') === 'on', status });
    } catch (e) {
      if (e instanceof LastAdminError) return fail(409, { error: m.less_ideal_barbel_dash(), id });
      if (e instanceof NotFoundError) return fail(404, { error: m.slimy_sad_scallop_hush(), id });
      if (e instanceof ForbiddenError) return fail(403, { error: m.this_quaint_loris_cure(), id });
      throw e;
    }
    return { ok: true, id };
  },
};
