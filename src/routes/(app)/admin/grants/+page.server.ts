import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth/requireUser';
import {
  InvalidGrantError,
  NotFoundError,
  createGrant,
  deleteGrant,
  listGrants,
  loadGrantChoices,
  updateGrant,
} from '$lib/server/repos/admin';
import { ForbiddenError } from '$lib/server/db/errors';
import * as m from '$lib/paraglide/messages.js';

export const load: PageServerLoad = async (event) => {
  requireAdmin(event, m.this_quaint_loris_cure());
  const [grants, choices] = await Promise.all([listGrants(), loadGrantChoices()]);
  return { grants, choices };
};

const str = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const level = (data: FormData) => (str(data, 'level') === 'WRITE' ? 'WRITE' : 'READ');

function failure(e: unknown) {
  if (e instanceof InvalidGrantError) return fail(400, { error: m.stout_known_slug_laugh() });
  if (e instanceof NotFoundError) return fail(404, { error: m.slimy_sad_scallop_hush() });
  if (e instanceof ForbiddenError) return fail(403, { error: m.this_quaint_loris_cure() });
  throw e;
}

const TARGETS = ['user', 'group'] as const;
const SCOPES = ['person', 'project', 'type', 'record'] as const;

export const actions: Actions = {
  create: async (event) => {
    requireAdmin(event, m.this_quaint_loris_cure());
    const data = await event.request.formData();
    const targetKind = TARGETS.find((k) => k === str(data, 'targetKind'));
    const scopeKind = SCOPES.find((k) => k === str(data, 'scopeKind'));
    // The picker for the chosen kind posts as `<kind>Id`; the others are ignored.
    const targetId = targetKind ? str(data, `target_${targetKind}`) : '';
    const scopeId = scopeKind ? str(data, `scope_${scopeKind}`) : '';
    if (!targetKind || !scopeKind || !targetId || !scopeId)
      return fail(400, { error: m.stout_known_slug_laugh() });
    try {
      await createGrant({
        target: { kind: targetKind, id: targetId },
        scope: { kind: scopeKind, id: scopeId },
        level: level(data),
        hideAmounts: data.get('hideAmounts') === 'on',
      });
    } catch (e) {
      return failure(e);
    }
    return { ok: true };
  },
  update: async (event) => {
    requireAdmin(event, m.this_quaint_loris_cure());
    const data = await event.request.formData();
    try {
      await updateGrant(str(data, 'id'), {
        level: level(data),
        hideAmounts: data.get('hideAmounts') === 'on',
      });
    } catch (e) {
      return failure(e);
    }
    return { ok: true };
  },
  delete: async (event) => {
    requireAdmin(event, m.this_quaint_loris_cure());
    const data = await event.request.formData();
    try {
      await deleteGrant(str(data, 'id'));
    } catch (e) {
      return failure(e);
    }
    return { ok: true };
  },
};
