import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/prisma';
import { userSettingsSchema } from '$lib/schemas/userSettings';
import { requireUser } from '$lib/server/auth/requireUser';

export const load: PageServerLoad = async (event) => {
  const sessionUser = requireUser(event);

  const form = await superValidate(
    { color: sessionUser.color, avatarSeed: sessionUser.avatarSeed },
    zod4(userSettingsSchema),
  );

  return { form, user: sessionUser };
};

export const actions: Actions = {
  default: async (event) => {
    const sessionUser = requireUser(event);

    const form = await superValidate(event, zod4(userSettingsSchema));
    if (!form.valid) return fail(400, { form });

    await prisma.user.update({ where: { id: sessionUser.id }, data: form.data });

    return { form };
  },
};
