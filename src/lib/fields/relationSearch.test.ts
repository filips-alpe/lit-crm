import { describe, expect, it, vi } from 'vitest';
import { moveActive, optionsUrl, searchOptions } from './relationSearch';

describe('optionsUrl', () => {
  it('encodes the query and only sends exclude for record searches', () => {
    expect(optionsUrl({ kind: 'user', q: 'a b&c', excludeId: 'x' })).toBe(
      '/data/options?kind=user&q=a+b%26c',
    );
    expect(optionsUrl({ kind: 'record', q: '', excludeId: 'r1' })).toBe(
      '/data/options?kind=record&q=&exclude=r1',
    );
  });
});

describe('searchOptions', () => {
  it('returns the options array from the response body', async () => {
    const fetchFn = vi.fn(async () => Response.json({ options: [{ id: 'a' }] }));
    expect(await searchOptions({ kind: 'user', q: 'a' }, { fetch: fetchFn })).toEqual([
      { id: 'a' },
    ]);
  });

  it('rejects on a non-OK response', async () => {
    const fetchFn = vi.fn(async () => Response.json({ error: 'unauthorized' }, { status: 401 }));
    await expect(searchOptions({ kind: 'user', q: '' }, { fetch: fetchFn })).rejects.toThrow('401');
  });
});

describe('moveActive', () => {
  it('wraps ArrowDown/ArrowUp and supports Home/End', () => {
    expect(moveActive(-1, 'ArrowDown', 3)).toBe(0);
    expect(moveActive(2, 'ArrowDown', 3)).toBe(0);
    expect(moveActive(0, 'ArrowDown', 3)).toBe(1);
    expect(moveActive(-1, 'ArrowUp', 3)).toBe(2);
    expect(moveActive(0, 'ArrowUp', 3)).toBe(2);
    expect(moveActive(2, 'ArrowUp', 3)).toBe(1);
    expect(moveActive(1, 'Home', 3)).toBe(0);
    expect(moveActive(0, 'End', 3)).toBe(2);
  });

  it('ignores other keys and empty lists', () => {
    expect(moveActive(0, 'a', 3)).toBeNull();
    expect(moveActive(-1, 'ArrowDown', 0)).toBeNull();
  });
});
