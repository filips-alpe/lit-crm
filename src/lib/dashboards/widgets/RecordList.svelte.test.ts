import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RecordList from './RecordList.svelte';
import type { DashboardRecord } from '../types';

const letterType = {
  id: 't1',
  code: 'Letter',
  color: '#a00',
  iconSeed: null,
  rendererId: 'correspondence',
  layout: {
    fields: [
      { id: 'from', label: 'From', kind: 'text' as const, writeTo: 'from' },
      { id: 'to', label: 'To', kind: 'text' as const, writeTo: 'to' },
    ],
  },
};

const record = (id: string): DashboardRecord =>
  ({
    id,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    status: 'ACTIVE',
    title: `Letter ${id}`,
    note: null,
    from: 'Polly Hewson',
    to: 'Sarah Bache',
    type: letterType,
    creator: null,
    assignee: null,
    projects: [],
    role: 'creator',
  }) as unknown as DashboardRecord;

describe('RecordList', () => {
  for (const variant of ['row', 'card'] as const) {
    it(`${variant}: links each entry once and never nests anchors`, () => {
      render(RecordList, { records: [record('a'), record('b')], variant });
      expect(document.querySelectorAll('a a')).toHaveLength(0);
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/data/"]'));
      expect(links.filter((a) => /\/data\/(a|b)$/.test(a.pathname))).toHaveLength(2);
      expect(links.map((a) => a.getAttribute('aria-label'))).toEqual(
        expect.arrayContaining(['Letter a', 'Letter b']),
      );
      // The renderer's own correspondent links survive as siblings, not children.
      expect(document.querySelectorAll('a[href*="correspondent="]').length).toBeGreaterThan(0);
    });
  }

  it('shows the empty text with no records', () => {
    render(RecordList, { records: [], empty: 'Nothing' });
    expect(document.body.textContent).toContain('Nothing');
  });
});
