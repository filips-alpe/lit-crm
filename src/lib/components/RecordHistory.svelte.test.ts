import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RecordHistory from './RecordHistory.svelte';
import type { HistoryEntry } from '$lib/history/types';

const layout = { fields: [{ label: 'Headline', writeTo: 'title' }] };
const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: '1',
  at: '2026-11-10T10:00:00.000Z',
  kind: 'record',
  action: 'UPDATE',
  actorName: 'Alice',
  changed: [],
  values: {},
  projectCode: null,
  ...over,
});
const items = () => Array.from(document.querySelectorAll('[data-testid="record-history"] li'));

describe('RecordHistory', () => {
  it('lists the entries in the order given, with labelled changed values', () => {
    render(RecordHistory, {
      layout,
      history: {
        nextBefore: null,
        entries: [
          entry({ id: '3', changed: ['title'], values: { title: 'New' } }),
          entry({ id: '2', kind: 'link', action: 'INSERT', projectCode: 'Alpha' }),
          entry({ id: '1', action: 'INSERT' }),
        ],
      },
    });
    const rows = items();
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Alice changed Headline');
    expect(rows[0].textContent).toContain('New');
    expect(rows[1].textContent).toContain('Alice added the record to project Alpha');
    expect(rows[2].textContent).toContain('Alice created the record');
  });

  it('names an unknown actor and shows a redaction row', () => {
    render(RecordHistory, {
      layout,
      history: {
        nextBefore: null,
        entries: [entry({ action: 'REDACT', actorName: null, changed: ['title'] })],
      },
    });
    expect(items()[0].textContent).toContain('Unknown user redacted Headline');
  });

  it('says so when there is no history', () => {
    render(RecordHistory, { layout, history: { entries: [], nextBefore: null } });
    expect(items()).toHaveLength(0);
    expect(document.body.textContent).toContain('No history yet.');
  });
});
