import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { DEFAULT_TYPE_COLOR, typeSchema } from '$lib/schemas/types';
import { starterLayout } from '$lib/forms/builder';
import { sampleIcons } from '$lib/icons/typeIcons';
import { requireAdmin } from '$lib/server/auth/requireUser';
import * as m from '$lib/paraglide/messages.js';
import { saveTypeForm } from '../saveType';

export const load: PageServerLoad = async (event) => {
  requireAdmin(event, m.round_white_turkey_reside());
  const form = await superValidate(zod4(typeSchema));
  form.data.color = DEFAULT_TYPE_COLOR;
  form.data.iconSeed = sampleIcons(1)[0];
  form.data.layout = starterLayout();
  return { form };
};

export const actions: Actions = {
  save: async (event) => {
    requireAdmin(event, m.round_white_turkey_reside());
    return saveTypeForm(event.request, null);
  },
};
