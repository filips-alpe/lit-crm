import type { LayoutServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth/requireUser';
import * as m from '$lib/paraglide/messages.js';

// The whole admin area is admin-only: guests go to login, everyone else gets a 403.
export const load: LayoutServerLoad = (event) => {
  requireAdmin(event, m.this_quaint_loris_cure());
  return {};
};
