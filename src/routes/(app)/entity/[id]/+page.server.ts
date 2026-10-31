import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';
import { getBestPage } from '$lib/server/repos/bestPage';
import * as m from '$lib/paraglide/messages.js';

export const load: PageServerLoad = async (event) => {
  requireUser(event);
  const raw = Number(event.url.searchParams.get('page'));
  const page = await getBestPage(event.params.id, { page: Number.isFinite(raw) ? raw : 1 });
  if (!page) error(404, m.cozy_late_capybara_greet());
  return { page };
};
