import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { DEFAULT_TYPE_COLOR, typeSchema } from '$lib/schemas/types';
import { starterLayout } from '$lib/forms/builder';
import { sampleIcons } from '$lib/icons/typeIcons';
import { requireUser } from '$lib/server/auth/requireUser';
import { saveTypeForm } from '../saveType';

export const load: PageServerLoad = async (event) => {
  requireUser(event);
  const form = await superValidate(zod4(typeSchema));
  form.data.color = DEFAULT_TYPE_COLOR;
  form.data.iconSeed = sampleIcons(1)[0];
  form.data.layout = starterLayout();
  return { form };
};

export const actions: Actions = {
  save: async (event) => {
    requireUser(event);
    return saveTypeForm(event.request, null);
  },
};
