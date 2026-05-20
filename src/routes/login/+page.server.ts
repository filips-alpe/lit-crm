import { fail, redirect } from '@sveltejs/kit';
import { setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages.js';
import { prisma } from '$lib/prisma';
import { loginSchema } from '$lib/schemas/login';
import { setSession } from '$lib/server/auth/session';
import { UserStatus } from '../../../generated/prisma/enums';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) redirect(303, '/');

  const users = await prisma.user.findMany({
    where: { status: UserStatus.ACTIVE },
    select: { id: true, username: true, name: true, color: true, avatarSeed: true },
    orderBy: [{ name: 'asc' }],
  });
  const form = await superValidate(zod4(loginSchema));

  return { users, form };
};

export const actions: Actions = {
  default: async (event) => {
    const form = await superValidate(event, zod4(loginSchema));
    if (!form.valid) return fail(400, { form });

    const user = await prisma.user.findUnique({
      where: { username: form.data.username, status: UserStatus.ACTIVE },
    });

    if (!user) {
      setError(form, 'username', m.just_soft_rabbit_dream());
      return fail(401, { form });
    }

    setSession(event.cookies, user.id, event.url);

    redirect(303, '/');
  },
};
