import { describe, expect, it } from 'vitest';
import { avatarUrl } from './avatar';
import { normalizeHex } from './hex';
import { iconUrl } from './typeIcons';

const decode = (uri: string) => {
  expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true);
  return decodeURIComponent(uri.slice('data:image/svg+xml;utf8,'.length));
};

describe('normalizeHex', () => {
  it('strips # and lower-cases', () => {
    expect(normalizeHex('#AABBCC')).toBe('aabbcc');
    expect(normalizeHex('f0a')).toBe('f0a');
  });
  it('falls back for malformed input', () => {
    expect(normalizeHex('not-a-colour')).toBe('999999');
    expect(normalizeHex('')).toBe('999999');
  });
});

describe('avatarUrl', () => {
  it('returns an inline SVG data URI, never a remote URL', () => {
    const uri = avatarUrl('bfranklin', '#336699');
    expect(uri).not.toMatch(/https?:/);
    expect(decode(uri)).toContain('<svg');
  });
  it('is deterministic per seed and colour, and memoized', () => {
    expect(avatarUrl('a', '#336699')).toBe(avatarUrl('a', '#336699'));
    expect(avatarUrl('a', '#336699')).not.toBe(avatarUrl('b', '#336699'));
  });
  it('colours the hair with the user colour', () => {
    expect(avatarUrl('a', '#336699')).not.toBe(avatarUrl('a', '#cc3366'));
    expect(decode(avatarUrl('a', '#ff0000')).toLowerCase()).toContain('#ff0000');
  });
});

describe('iconUrl', () => {
  it('renders a known icon name with the given background', () => {
    const svg = decode(iconUrl('clock', 'x', 'ff0000'));
    expect(svg).toContain('<svg');
    expect(svg.toLowerCase()).toContain('#ff0000');
  });
  it('uses the icon name instead of the seed when known', () => {
    expect(iconUrl('clock', 'a', 'ff0000')).toBe(iconUrl('clock', 'b', 'ff0000'));
  });
  it('falls back to a seed-derived icon for unknown names', () => {
    expect(iconUrl('zzz', 'a', 'ff0000')).toBe(iconUrl('zzz', 'b', 'ff0000'));
    expect(iconUrl(null, 'a', 'ff0000')).not.toBe(iconUrl(null, 'b', 'ff0000'));
    expect(iconUrl(null, 'a', 'ff0000')).toBe(iconUrl(null, 'a', 'ff0000'));
  });
});
