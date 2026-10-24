import type { DashboardComponent } from '$lib/dashboards/types';
import { collectDashboards } from './collect';

/**
 * Per-user dashboards (keyed by `User.username`) from every installed extension.
 * Discovered, not registered: any `src/extensions/<id>/dashboards/index.ts` that
 * exports `dashboards` is picked up. Use `bun run ext` to install and uninstall.
 */
export const extensionDashboards: Record<string, DashboardComponent> = collectDashboards(
  import.meta.glob<{ dashboards: Record<string, DashboardComponent> }>('./*/dashboards/index.ts', {
    eager: true,
  }),
);
