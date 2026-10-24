import type { RecordRenderer } from '$lib/renderers/registry';
import type { DashboardComponent } from '$lib/dashboards/types';

/** `./acme/renderers/index.ts` → `acme`. */
export function extensionIdOf(path: string): string {
  return path.replace(/^\.\//, '').split('/')[0];
}

function claim(owners: Map<string, string>, key: string, ext: string, what: string): void {
  const prior = owners.get(key);
  if (prior) throw new Error(`${what} "${key}" is provided by both "${prior}" and "${ext}"`);
  owners.set(key, ext);
}

/** Flatten every extension's renderers (path order), refusing duplicate ids. */
export function collectRenderers(
  modules: Record<string, { renderers: RecordRenderer[] }>,
): RecordRenderer[] {
  const owners = new Map<string, string>();
  const out: RecordRenderer[] = [];
  for (const path of Object.keys(modules).sort()) {
    const ext = extensionIdOf(path);
    for (const renderer of modules[path].renderers) {
      claim(owners, renderer.id, ext, 'Renderer id');
      out.push(renderer);
    }
  }
  return out;
}

/** Merge every extension's dashboards, refusing a username claimed twice. */
export function collectDashboards(
  modules: Record<string, { dashboards: Record<string, DashboardComponent> }>,
): Record<string, DashboardComponent> {
  const owners = new Map<string, string>();
  const out: Record<string, DashboardComponent> = {};
  for (const path of Object.keys(modules).sort()) {
    const ext = extensionIdOf(path);
    for (const [username, component] of Object.entries(modules[path].dashboards)) {
      claim(owners, username, ext, 'Dashboard for');
      out[username] = component;
    }
  }
  return out;
}
