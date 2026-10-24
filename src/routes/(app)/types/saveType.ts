import { error, fail, redirect } from '@sveltejs/kit';
import { setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { typeSchema } from '$lib/schemas/types';
import { DuplicateCodeError, saveType } from '$lib/server/repos/types';
import * as m from '$lib/paraglide/messages.js';

/** The `save` form action shared by the create (`id` = null) and edit routes. */
export async function saveTypeForm(request: Request, id: string | null) {
  const form = await superValidate(request, zod4(typeSchema));
  if (!form.valid) return fail(400, { form });

  try {
    const result = await saveType({
      id: id ?? '',
      code: form.data.code,
      description: form.data.description ?? null,
      color: form.data.color,
      iconSeed: form.data.iconSeed ?? null,
      layout: form.data.layout ?? null,
      rendererId: form.data.rendererId ?? null,
    });

    if (result.kind === 'not-found') {
      throw error(404, m.pink_kind_loris_believe());
    }
  } catch (e) {
    if (e instanceof DuplicateCodeError) {
      return setError(form, 'code', m.empty_flat_antelope_bake());
    }
    throw e;
  }

  throw redirect(303, '/types');
}
