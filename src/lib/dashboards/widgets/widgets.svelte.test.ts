import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
  Epigraph,
  PersonList,
  Sparkline,
  StatTile,
  Timeline,
  TypeBreakdown,
  YearBars,
} from './index';
import type { Correspondent, TypeCount } from '../types';

describe('dashboard widgets', () => {
  it('StatTile shows label, value and hint', () => {
    render(StatTile, { label: 'Letters', value: 42, hint: 'since 1757' });
    expect(document.body.textContent).toContain('Letters');
    expect(document.body.textContent).toContain('42');
    expect(document.body.textContent).toContain('since 1757');
  });

  it('YearBars draws one bar per year and labels the ends; renders nothing when empty', () => {
    const { unmount } = render(YearBars, {
      data: [
        { year: 1757, count: 2 },
        { year: 1758, count: 0 },
        { year: 1759, count: 5 },
      ],
    });
    expect(document.querySelectorAll('rect')).toHaveLength(3);
    expect(document.body.textContent).toContain('1757');
    expect(document.body.textContent).toContain('1759');
    unmount();
    render(YearBars, { data: [] });
    expect(document.querySelector('svg')).toBeNull();
  });

  it('Timeline lists items in order and shows the empty text', () => {
    const { unmount } = render(Timeline, {
      items: [
        { id: 'a', date: new Date('1757-01-01'), title: 'First', link: false },
        { id: 'b', date: null, title: 'Second', link: false },
      ],
    });
    expect(Array.from(document.querySelectorAll('li')).map((l) => l.textContent)).toEqual([
      expect.stringContaining('First'),
      expect.stringContaining('Second'),
    ]);
    unmount();
    render(Timeline, { items: [], empty: 'Nothing' });
    expect(document.body.textContent).toContain('Nothing');
  });

  it('PersonList respects the limit', () => {
    const people: Correspondent[] = ['A', 'B', 'C'].map((name, i) => ({
      name,
      sent: 0,
      received: 0,
      total: 3 - i,
      first: null,
      last: null,
    }));
    render(PersonList, { people, limit: 2 });
    expect(document.querySelectorAll('li')).toHaveLength(2);
  });

  it('TypeBreakdown renders a row per type', () => {
    const counts: TypeCount[] = [
      {
        typeId: 't1',
        code: 'Letter',
        color: '#a00',
        iconSeed: null,
        count: 4,
        created: 4,
        assigned: 0,
      },
    ];
    render(TypeBreakdown, { counts });
    expect(document.body.textContent).toContain('Letter');
    expect(document.body.textContent).toContain('4');
  });

  it('Epigraph quotes with attribution', () => {
    render(Epigraph, { text: 'Well done', by: 'B. Franklin', source: 'Poor Richard' });
    expect(document.querySelector('blockquote')?.textContent).toContain('Well done');
    expect(document.querySelector('cite')?.textContent).toBe('Poor Richard');
  });

  it('Sparkline draws one point per value and renders nothing for fewer than two', () => {
    const { unmount } = render(Sparkline, { values: [1, 3, 2, 5] });
    const points = document.querySelector('polyline')?.getAttribute('points') ?? '';
    expect(points.split(' ')).toHaveLength(4);
    unmount();
    const { unmount: unmountOne } = render(Sparkline, { values: [4] });
    expect(document.querySelector('svg')).toBeNull();
    unmountOne();
    render(Sparkline, { values: [] });
    expect(document.querySelector('svg')).toBeNull();
  });

  it('Sparkline draws a flat series without NaN', () => {
    render(Sparkline, { values: [2, 2, 2] });
    expect(document.querySelector('polyline')?.getAttribute('points')).not.toContain('NaN');
  });

  it('YearBars handles a single year', () => {
    render(YearBars, { data: [{ year: 1757, count: 3 }] });
    expect(document.querySelectorAll('rect')).toHaveLength(1);
  });
});
