import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';
import { loadDashboardData } from '$lib/server/repos/dashboard';
import type { DashboardUser } from '$lib/dashboards/types';

export const load: PageServerLoad = async (event) => {
  const u = requireUser(event);
  const user: DashboardUser = {
    id: u.id,
    username: u.username,
    name: u.name,
    bio: u.bio,
    color: u.color,
    avatarSeed: u.avatarSeed,
  };
  return { dashboard: { user, data: await loadDashboardData(user) } };
};
