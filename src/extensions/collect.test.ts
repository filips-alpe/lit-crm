import { describe, expect, it } from 'vitest';
import type { RecordRenderer } from '$lib/renderers/registry';
import type { DashboardComponent } from '$lib/dashboards/types';
import type { ExtensionShell, NavItem, RecordAction } from '$lib/extensions/types';
import {
  actionsForPlacement,
  collectDashboards,
  collectNavItems,
  collectRecordActions,
  collectRenderers,
  collectShell,
  extensionIdOf,
  sortNavItems,
} from './collect';
import { recordRenderers } from '$lib/renderers/registry';
import { extensionNavItems } from './nav';
import { extensionRecordActions } from './recordActions';
import { extensionShell } from './shell';

const r = (id: string) => ({ id, name: id }) as RecordRenderer;
const d = () => ({}) as DashboardComponent;

describe('extensionIdOf', () => {
  it('reads the folder name from a glob path', () => {
    expect(extensionIdOf('./franklin/renderers/index.ts')).toBe('franklin');
  });
});

describe('collectRenderers', () => {
  it('concatenates every extension in path order', () => {
    const out = collectRenderers({
      './b/renderers/index.ts': { renderers: [r('b1')] },
      './a/renderers/index.ts': { renderers: [r('a1'), r('a2')] },
    });
    expect(out.map((x) => x.id)).toEqual(['a1', 'a2', 'b1']);
  });

  it('returns nothing when no extension is installed', () => {
    expect(collectRenderers({})).toEqual([]);
  });

  it('rejects an id used by two extensions, naming both', () => {
    expect(() =>
      collectRenderers({
        './a/renderers/index.ts': { renderers: [r('x')] },
        './b/renderers/index.ts': { renderers: [r('x')] },
      }),
    ).toThrow(/"x".*a.*b/);
  });
});

describe('collectDashboards', () => {
  it('merges dashboards keyed by username', () => {
    const out = collectDashboards({
      './a/dashboards/index.ts': { dashboards: { ann: d() } },
      './b/dashboards/index.ts': { dashboards: { bob: d() } },
    });
    expect(Object.keys(out)).toEqual(['ann', 'bob']);
  });

  it('rejects a username claimed by two extensions', () => {
    expect(() =>
      collectDashboards({
        './a/dashboards/index.ts': { dashboards: { ann: d() } },
        './b/dashboards/index.ts': { dashboards: { ann: d() } },
      }),
    ).toThrow(/"ann".*a.*b/);
  });
});

const nav = (id: string, order?: number) =>
  ({ id, href: `/x/${id}`, label: () => id, order }) as NavItem;
const action = (id: string, placement = 'detail', order?: number) =>
  ({ id, placement, order, component: {} }) as unknown as RecordAction;

describe('collectShell', () => {
  it('merges slots from different extensions', () => {
    const layout = {} as ExtensionShell['Layout'];
    const login = {} as ExtensionShell['Login'];
    const out = collectShell({
      './a/shell/index.ts': { shell: { Layout: layout, home: '/x/a/home' } },
      './b/shell/index.ts': { shell: { Login: login } },
    });
    expect(out).toEqual({ Layout: layout, Login: login, home: '/x/a/home' });
  });

  it('is empty when no extension provides a shell', () => {
    expect(collectShell({})).toEqual({});
    expect(collectShell({ './a/shell/index.ts': { shell: {} } })).toEqual({});
  });

  it.each(['Layout', 'Login'] as const)(
    'rejects two extensions providing %s, naming both',
    (slot) => {
      const c = {} as never;
      expect(() =>
        collectShell({
          './a/shell/index.ts': { shell: { [slot]: c } },
          './b/shell/index.ts': { shell: { [slot]: c } },
        }),
      ).toThrow(new RegExp(`"${slot}".*a.*b`));
    },
  );

  it('rejects two extensions providing home, naming both', () => {
    expect(() =>
      collectShell({
        './a/shell/index.ts': { shell: { home: '/x/a' } },
        './b/shell/index.ts': { shell: { home: '/x/b' } },
      }),
    ).toThrow(/"home".*a.*b/);
  });

  it.each(['x/a', '//evil.example', '/\\evil.example', ''])('rejects home %j', (home) => {
    expect(() => collectShell({ './a/shell/index.ts': { shell: { home } } })).toThrow(
      /must be a path on this site/,
    );
  });
});

describe('collectNavItems', () => {
  it('orders by order (default 1000), then id, across extensions', () => {
    const out = collectNavItems({
      './b/nav.ts': { navItems: [nav('b2'), nav('b1', 5)] },
      './a/nav.ts': { navItems: [nav('a1', 2000), nav('a2')] },
    });
    expect(out.map((i) => i.id)).toEqual(['b1', 'a2', 'b2', 'a1']);
  });

  it('returns nothing when no extension is installed', () => {
    expect(collectNavItems({})).toEqual([]);
  });

  it('rejects an id used by two extensions, naming both', () => {
    expect(() =>
      collectNavItems({
        './a/nav.ts': { navItems: [nav('x')] },
        './b/nav.ts': { navItems: [nav('x')] },
      }),
    ).toThrow(/"x".*a.*b/);
  });

  it('rejects an id reserved by the app', () => {
    expect(() => collectNavItems({ './a/nav.ts': { navItems: [nav('data')] } }, ['data'])).toThrow(
      /"data".*the app.*a/,
    );
  });

  it('sortNavItems does not mutate its input', () => {
    const items = [nav('b'), nav('a')];
    expect(sortNavItems(items).map((i) => i.id)).toEqual(['a', 'b']);
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('collectRecordActions', () => {
  it('orders by order (default 0), then id, across extensions', () => {
    const out = collectRecordActions({
      './b/recordActions.ts': { recordActions: [action('b2'), action('b1', 'detail', -1)] },
      './a/recordActions.ts': { recordActions: [action('a1', 'row', 5), action('a2')] },
    });
    expect(out.map((a) => a.id)).toEqual(['b1', 'a2', 'b2', 'a1']);
  });

  it('returns nothing when no extension is installed', () => {
    expect(collectRecordActions({})).toEqual([]);
  });

  it('rejects an id used by two extensions, naming both', () => {
    expect(() =>
      collectRecordActions({
        './a/recordActions.ts': { recordActions: [action('x')] },
        './b/recordActions.ts': { recordActions: [action('x', 'row')] },
      }),
    ).toThrow(/"x".*a.*b/);
  });

  it('rejects an action without a placement', () => {
    expect(() =>
      collectRecordActions({ './a/recordActions.ts': { recordActions: [action('x', '')] } }),
    ).toThrow(/"x" of "a" has no placement/);
  });

  it('actionsForPlacement keeps the order and drops other placements', () => {
    const list = collectRecordActions({
      './a/recordActions.ts': {
        recordActions: [action('a', 'detail'), action('b', 'row'), action('c', 'detail')],
      },
    });
    expect(actionsForPlacement(list, 'detail').map((a) => a.id)).toEqual(['a', 'c']);
    expect(actionsForPlacement(list, 'none')).toEqual([]);
  });
});

describe('installed extensions', () => {
  it('has unique nav and record action ids', () => {
    // The collectors already throw on import; this keeps the installed set honest in one place.
    const unique = (ids: string[]) => new Set(ids).size === ids.length;
    expect(unique(extensionNavItems.map((i) => i.id))).toBe(true);
    expect(unique(extensionRecordActions.map((a) => a.id))).toBe(true);
    expect(typeof extensionShell).toBe('object');
  });

  it('has unique renderer ids across built-ins and extensions', () => {
    const ids = recordRenderers.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
