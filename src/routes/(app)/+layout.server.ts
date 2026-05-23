import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';

export const load: LayoutServerLoad = (event) => {
  const user = requireUser(event);
  return { user };
};
