import { describe, expect, it } from 'vitest';
import { humanizeIconName, sampleIcons, TYPE_ICONS } from './typeIcons';

describe('humanizeIconName', () => {
  it('title-cases a single word', () => {
    expect(humanizeIconName('clock')).toBe('Clock');
  });

  it('splits camelCase into space-separated lower-cased words', () => {
    expect(humanizeIconName('cloudDrizzle')).toBe('Cloud drizzle');
    expect(humanizeIconName('emojiHeartEyes')).toBe('Emoji heart eyes');
  });

  it('separates trailing numbers with a space', () => {
    expect(humanizeIconName('dice5')).toBe('Dice 5');
    expect(humanizeIconName('basket3')).toBe('Basket 3');
  });

  it('handles empty / undefined input', () => {
    expect(humanizeIconName('')).toBe('');
    expect(humanizeIconName(undefined)).toBe('');
    expect(humanizeIconName(null)).toBe('');
  });
});

describe('sampleIcons', () => {
  it('returns the requested count of distinct icons', () => {
    const picks = sampleIcons(10);
    expect(picks).toHaveLength(10);
    expect(new Set(picks).size).toBe(10);
    for (const p of picks) expect(TYPE_ICONS).toContain(p);
  });

  it('respects the exclude list', () => {
    const excluded = ['clock', 'star', 'heart'];
    const picks = sampleIcons(5, excluded);
    for (const p of picks) expect(excluded).not.toContain(p);
  });
});
