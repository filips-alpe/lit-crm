import { fail, redirect } from '@sveltejs/kit';
import { setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages.js';
import { prisma } from '$lib/prisma';
import { loginSchema } from '$lib/schemas/login';
import { safeRedirectTo } from '$lib/server/auth/redirectTo';
import { setSession } from '$lib/server/auth/session';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) redirect(303, '/');

  // Nobody is logged in yet, so the tables are closed; this definer function lists the
  // active users for the picker and nothing else.
  const users = await prisma.$queryRaw<
    { id: string; username: string; name: string; color: string; avatarSeed: string | null }[]
  >`SELECT id, username, name, color, "avatarSeed" FROM lit_login_users()`;
  const form = await superValidate(zod4(loginSchema));

  return { users, form };
};

export const actions: Actions = {
  default: async (event) => {
    const form = await superValidate(event, zod4(loginSchema));
    if (!form.valid) return fail(400, { form });

    const [user] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM lit_resolve_user(${form.data.username})`;

    if (!user) {
      setError(form, 'username', m.just_soft_rabbit_dream());
      return fail(401, { form });
    }

    setSession(event.cookies, user.id, event.url);

    redirect(303, safeRedirectTo(event.url.searchParams.get('redirectTo')));
  },
};
