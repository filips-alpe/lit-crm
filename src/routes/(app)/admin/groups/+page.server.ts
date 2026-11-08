import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth/requireUser';
import {
  DuplicateNameError,
  NotFoundError,
  addMember,
  createGroup,
  deleteGroup,
  listAdminUsers,
  listGroups,
  removeMember,
  updateGroup,
} from '$lib/server/repos/admin';
import { ForbiddenError } from '$lib/server/db/errors';
import * as m from '$lib/paraglide/messages.js';

export const load: PageServerLoad = async (event) => {
  requireAdmin(event, m.this_quaint_loris_cure());
  const [groups, users] = await Promise.all([listGroups(), listAdminUsers()]);
  return { groups, users };
};

const str = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

/** Map the repo's typed errors to a clean failure. */
function failure(e: unknown) {
  if (e instanceof DuplicateNameError) return fail(409, { error: m.flaky_fancy_rook_assure() });
  if (e instanceof NotFoundError) return fail(404, { error: m.slimy_sad_scallop_hush() });
  if (e instanceof ForbiddenError) return fail(403, { error: m.this_quaint_loris_cure() });
  throw e;
}

export const actions: Actions = {
  create: async (event) => {
    requireAdmin(event, m.this_quaint_loris_cure());
    const data = await event.request.formData();
    const name = str(data, 'name');
    if (!name) return fail(400, { error: m.icy_actual_swallow_hush() });
    try {
      await createGroup({ name, description: str(data, 'description') || null });
    } catch (e) {
      return failure(e);
    }
    return { ok: true };
  },
  update: async (event) => {
    requireAdmin(event, m.this_quaint_loris_cure());
    const data = await event.request.formData();
    const name = str(data, 'name');
    if (!name) return fail(400, { error: m.icy_actual_swallow_hush() });
    try {
      await updateGroup(str(data, 'id'), { name, description: str(data, 'description') || null });
    } catch (e) {
      return failure(e);
    }
    return { ok: true };
  },
  delete: async (event) => {
    requireAdmin(event, m.this_quaint_loris_cure());
    const data = await event.request.formData();
    try {
      await deleteGroup(str(data, 'id'));
    } catch (e) {
      return failure(e);
    }
    return { ok: true };
  },
  addMember: async (event) => {
    requireAdmin(event, m.this_quaint_loris_cure());
    const data = await event.request.formData();
    try {
      await addMember(str(data, 'groupId'), str(data, 'userId'));
    } catch (e) {
      return failure(e);
    }
    return { ok: true };
  },
  removeMember: async (event) => {
    requireAdmin(event, m.this_quaint_loris_cure());
    const data = await event.request.formData();
    try {
      await removeMember(str(data, 'groupId'), str(data, 'userId'));
    } catch (e) {
      return failure(e);
    }
    return { ok: true };
  },
};
