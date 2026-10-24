import { extensionDashboards } from '$extensions/dashboards';
import FallbackDashboard from './FallbackDashboard.svelte';
import type { DashboardComponent } from './types';

/** The signed-in user's dashboard (extensions contribute them, keyed by
 *  `User.username`); anyone without one gets {@link FallbackDashboard}. */
export function dashboardFor(username: string): DashboardComponent {
  const dashboards: Record<string, DashboardComponent> = extensionDashboards;
  return dashboards[username] ?? FallbackDashboard;
}
