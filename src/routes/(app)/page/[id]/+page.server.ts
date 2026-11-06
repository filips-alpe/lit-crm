import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';
import { loadBestPageInput } from '$lib/server/repos/bestPage';
import { buildBestPage } from '$lib/bestPage/assemble';
import * as m from '$lib/paraglide/messages.js';

// The best page of any record: assembled on the server into plain data, so the
// same page renders from SSR and after a client-side navigation.
export const load: PageServerLoad = async (event) => {
  requireUser(event);
  const input = await loadBestPageInput(event.params.id);
  if (!input) error(404, m.cozy_late_capybara_greet());
  return { page: buildBestPage(input) };
};
