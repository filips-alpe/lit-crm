import { describe, expect, it } from 'vitest';
import type { RecordRenderer } from '$lib/renderers/registry';
import type { DashboardComponent } from '$lib/dashboards/types';
import { collectDashboards, collectRenderers, extensionIdOf } from './collect';
import { recordRenderers } from '$lib/renderers/registry';

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

describe('installed extensions', () => {
  it('has unique renderer ids across built-ins and extensions', () => {
    const ids = recordRenderers.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
