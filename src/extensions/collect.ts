import type { RecordRenderer } from '$lib/renderers/registry';
import type { DashboardComponent } from '$lib/dashboards/types';
import type { ExtensionShell, NavItem, RecordAction } from '$lib/extensions/types';

/** `./franklin/renderers/index.ts` → `franklin`. */
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

/** Default `order` of an extension's nav item: after the built-in links (100, 200, 300). */
export const DEFAULT_NAV_ORDER = 1000;

const SHELL_SLOTS = ['Layout', 'Login', 'home'] as const;

/**
 * Merge every extension's `shell` slots. Each slot (`Layout`, `Login`, `home`) may come from
 * one extension only, so two shells fighting over the header fail at startup naming both.
 */
export function collectShell(modules: Record<string, { shell: ExtensionShell }>): ExtensionShell {
  const owners = new Map<string, string>();
  const out: ExtensionShell = {};
  for (const path of Object.keys(modules).sort()) {
    const ext = extensionIdOf(path);
    const shell = modules[path].shell;
    for (const slot of SHELL_SLOTS) {
      const value = shell[slot];
      if (value === undefined) continue;
      claim(owners, slot, ext, 'Shell slot');
      // A path on this site only: never `//host` or `/\host`, which browsers treat as another origin.
      if (slot === 'home' && !(typeof value === 'string' && /^\/(?![/\\])/.test(value))) {
        throw new Error(`Shell home of "${ext}" must be a path on this site, got "${value}"`);
      }
      (out as Record<string, unknown>)[slot] = value;
    }
  }
  return out;
}

const byOrderThenId = <T extends { id: string }>(order: (x: T) => number) => {
  return (a: T, b: T) => order(a) - order(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
};

/** Nav items by `order` (default {@link DEFAULT_NAV_ORDER}), then id; returns a new array. */
export const sortNavItems = (items: NavItem[]): NavItem[] =>
  [...items].sort(byOrderThenId((i) => i.order ?? DEFAULT_NAV_ORDER));

/**
 * Flatten every extension's `navItems`, sorted by `order` (default {@link DEFAULT_NAV_ORDER}),
 * then id. An id used twice, or one of `reservedIds` (the built-in links), is refused.
 */
export function collectNavItems(
  modules: Record<string, { navItems: NavItem[] }>,
  reservedIds: readonly string[] = [],
): NavItem[] {
  const owners = new Map<string, string>(reservedIds.map((id) => [id, 'the app']));
  const out: NavItem[] = [];
  for (const path of Object.keys(modules).sort()) {
    const ext = extensionIdOf(path);
    for (const item of modules[path].navItems) {
      claim(owners, item.id, ext, 'Nav item id');
      out.push(item);
    }
  }
  return sortNavItems(out);
}

/** Default `order` of a record action. */
export const DEFAULT_ACTION_ORDER = 0;

/** Flatten every extension's `recordActions` (by order, then id), refusing duplicate ids. */
export function collectRecordActions(
  modules: Record<string, { recordActions: RecordAction[] }>,
): RecordAction[] {
  const owners = new Map<string, string>();
  const out: RecordAction[] = [];
  for (const path of Object.keys(modules).sort()) {
    const ext = extensionIdOf(path);
    for (const action of modules[path].recordActions) {
      claim(owners, action.id, ext, 'Record action id');
      if (!action.placement) {
        throw new Error(`Record action "${action.id}" of "${ext}" has no placement`);
      }
      out.push(action);
    }
  }
  return out.sort(byOrderThenId((a) => a.order ?? DEFAULT_ACTION_ORDER));
}

/** The actions to render in one placement (the list is already ordered). */
export function actionsForPlacement(actions: RecordAction[], placement: string): RecordAction[] {
  return actions.filter((a) => a.placement === placement);
}
