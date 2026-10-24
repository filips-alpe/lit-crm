import { describe, expect, it } from 'vitest';
import { contrastRatio, readableTextColor, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white, accepting #rgb', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
  });
  it('is null for non-hex input', () => {
    expect(relativeLuminance('red')).toBeNull();
    expect(relativeLuminance('')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
  });
});

describe('readableTextColor', () => {
  it('uses white on dark backgrounds and dark text on light ones', () => {
    expect(readableTextColor('#1e3a8a')).toBe('#ffffff');
    expect(readableTextColor('#000000')).toBe('#ffffff');
    expect(readableTextColor('#fde047')).toBe('#1c1917');
    expect(readableTextColor('#ffffff')).toBe('#1c1917');
  });
  it('picks the higher-contrast option, reaching AA (4.5) wherever either can', () => {
    for (const bg of ['#00ff00', '#ffff00', '#00ffff', '#0000ff', '#1e3a8a', '#fde047']) {
      expect(contrastRatio(bg, readableTextColor(bg))!).toBeGreaterThanOrEqual(4.5);
    }
    for (const bg of ['#ff0000', '#808080', '#ff00ff']) {
      const best = readableTextColor(bg);
      const other = best === '#ffffff' ? '#1c1917' : '#ffffff';
      expect(contrastRatio(bg, best)!).toBeGreaterThanOrEqual(contrastRatio(bg, other)!);
    }
  });
  it('falls back to white for malformed colours', () => {
    expect(readableTextColor('nope')).toBe('#ffffff');
  });
});
