import { describe, expect, it } from 'vitest';
import { safeRedirectTo } from './redirectTo';

describe('safeRedirectTo', () => {
  it('keeps same-origin paths', () => {
    expect(safeRedirectTo('/data/1?x=2')).toBe('/data/1?x=2');
  });
  it('falls back to / for missing or external targets', () => {
    for (const v of [
      null,
      undefined,
      '',
      'https://evil.com',
      '//evil.com',
      '/\\evil.com',
      'data',
    ]) {
      expect(safeRedirectTo(v)).toBe('/');
    }
  });
});
