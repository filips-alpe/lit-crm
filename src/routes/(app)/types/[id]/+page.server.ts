import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { typeSchema } from '$lib/schemas/types';
import { layoutOrStarter } from '$lib/forms/builder';
import type { FormLayout } from '$lib/forms/layout';
import {
  countRecordsWithData,
  getTypeById,
  permanentlyDeleteType,
  restoreType,
  softDeleteType,
} from '$lib/server/repos/types';
import { requireUser } from '$lib/server/auth/requireUser';
import { saveTypeForm } from '../saveType';
import * as m from '$lib/paraglide/messages.js';

export const load: PageServerLoad = async (event) => {
  requireUser(event);
  const { params } = event;
  const row = await getTypeById(params.id);
  if (!row) throw error(404, m.pink_kind_loris_believe());

  const form = await superValidate(
    {
      id: row.id,
      code: row.code,
      description: row.description,
      color: row.color,
      iconSeed: row.iconSeed,
      layout: layoutOrStarter(row.layout as FormLayout | null),
      rendererId: row.rendererId,
    },
    zod4(typeSchema),
  );
  // Per-column record counts so the editor can warn before a layout change hides data.
  const columnCounts = await countRecordsWithData(row.id);
  return { form, editingDeleted: row.status === 'INACTIVE', columnCounts };
};

export const actions: Actions = {
  save: async (event) => {
    requireUser(event);
    return saveTypeForm(event.request, event.params.id);
  },

  delete: async (event) => {
    requireUser(event);
    const row = await softDeleteType(event.params.id);
    if (!row) return fail(404, { error: m.pink_kind_loris_believe() });
    throw redirect(303, '/types');
  },

  restore: async (event) => {
    requireUser(event);
    const row = await restoreType(event.params.id);
    if (!row) return fail(404, { error: m.pink_kind_loris_believe() });
    throw redirect(303, '/types');
  },

  permanentlyDelete: async (event) => {
    requireUser(event);
    const result = await permanentlyDeleteType(event.params.id);
    if (result.kind === 'not-found') return fail(404, { error: m.pink_kind_loris_believe() });
    if (result.kind === 'has-records') {
      return fail(409, {
        error: m.mad_large_newt_attend({ count: result.recordCount }),
        recordCount: result.recordCount,
      });
    }
    throw redirect(303, '/types');
  },
};
