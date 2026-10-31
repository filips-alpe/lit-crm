import { describe, expect, it } from 'vitest';
import { loadSources } from './fetch';
import { findVolumeTwoStart, mapLines } from './pages';

describe('mapLines (synthetic)', () => {
  it('assigns lines to leaves by non-whitespace character offsets', () => {
    const djvu = 'ab cd\nef\n\ngh\n';
    // search text has different whitespace than djvu but the same characters
    const st = 'abcd ef\ngh';
    // leaf0: "abcd" (0-4), leaf1: " ef\n" ... , leaf2: "gh"
    const pageindex = [
      [0, 4],
      [4, 8],
      [8, 10],
    ];
    const m = mapLines(
      'THE WRITINGS OF \n' + djvu + 'THE WRITINGS OF ',
      'THEWRITINGSOF' + st + 'THEWRITINGSOF',
      [[0, 13], ...pageindex.map(([a, b]) => [a + 13, b + 13]), [23, 36]],
      new Map([[2, 'ii']]),
    );
    expect(m.lines[0].leaf).toBe(0);
    expect(m.lines[1].leaf).toBe(1);
    expect(m.lines[2].leaf).toBe(2);
    expect(m.lines[2].page).toBe('ii');
    expect(m.lines[3].leaf).toBe(2); // blank line stays with previous
    expect(m.lines[4].leaf).toBe(3);
    expect(m.lines.at(-1)?.volume).toBe(2);
    expect(m.lines[1].volume).toBe(1);
  });

  it('throws when the two texts differ', () => {
    expect(() =>
      mapLines(
        'THE WRITINGS OF \nTHE WRITINGS OF \nx',
        'THEWRITINGSOFTHEWRITINGSOF',
        [[0, 26]],
        new Map(),
      ),
    ).toThrow(/non-whitespace/);
  });
});

describe('mapLines (real cache)', () => {
  const src = loadSources();
  const map = mapLines(src.djvu, src.searchtext, src.pageindex, src.pageLabels);

  it('reproduces the spot checks verified by hand', () => {
    expect(map.lines).toHaveLength(src.djvu.split('\n').length);
    // 0-based raw line indexes (the numbers used in the hand verification)
    const pos = (i: number) => map.lines[i];
    expect(pos(1473)).toMatchObject({ leaf: 52, page: '14', volume: 1 });
    expect(pos(11382)).toMatchObject({ leaf: 328, page: '266', volume: 1 });
    expect(pos(22213)).toMatchObject({ leaf: 630, page: '14', volume: 2 });
  });

  it('starts volume II at the second title page', () => {
    const lines = src.djvu.split('\n');
    expect(findVolumeTwoStart(lines)).toBe(19865);
    expect(map.lines[19864].volume).toBe(1);
    expect(map.lines[19865].volume).toBe(2);
  });

  it('has monotonic leaves and no line straddling two leaves', () => {
    for (let i = 1; i < map.lines.length; i++) {
      expect(map.lines[i].leaf).toBeGreaterThanOrEqual(map.lines[i - 1].leaf);
    }
    expect(map.straddling).toEqual([]);
  });
});
