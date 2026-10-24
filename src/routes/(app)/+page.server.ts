import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';
import { listRecordsForUser } from '$lib/server/repos/dashboard';
import { buildDashboardData } from '$lib/dashboards/aggregate';
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
  const records = await listRecordsForUser(u.id);
  return { dashboard: { user, data: buildDashboardData(user, records) } };
};
