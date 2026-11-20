import { afterEach, describe, expect, it, vi } from 'vitest';
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
  refs: {},
  projectCode: null,
  ...over,
});
const items = () => Array.from(document.querySelectorAll('[data-testid="record-history"] li'));

describe('RecordHistory', () => {
  it('lists the entries in the order given, with labelled changed values', () => {
    render(RecordHistory, {
      recordId: 'r1',
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
      recordId: 'r1',
      layout,
      history: {
        nextBefore: null,
        entries: [entry({ action: 'REDACT', actorName: null, changed: ['title'] })],
      },
    });
    expect(items()[0].textContent).toContain('Unknown user redacted Headline');
  });

  it('says so when there is no history', () => {
    render(RecordHistory, { recordId: 'r1', layout, history: { entries: [], nextBefore: null } });
    expect(items()).toHaveLength(0);
    expect(document.body.textContent).toContain('No history yet.');
  });

  describe('load more', () => {
    afterEach(() => vi.unstubAllGlobals());
    const more = () => document.querySelector<HTMLButtonElement>('[data-testid="history-more"]');

    it('appends the older page, keeps the order and drops the button on the last page', async () => {
      const fetchMock = vi.fn(async () =>
        Response.json({ entries: [entry({ id: '1', action: 'INSERT' })], nextBefore: null }),
      );
      vi.stubGlobal('fetch', fetchMock);
      render(RecordHistory, {
        recordId: 'r1',
        layout,
        history: {
          entries: [entry({ id: '2', changed: ['title'], values: { title: 'B' } })],
          nextBefore: '2',
        },
      });
      expect(items()).toHaveLength(1);
      more()!.click();
      await vi.waitFor(() => expect(items()).toHaveLength(2));
      expect(fetchMock).toHaveBeenCalledWith('/data/r1/history?before=2');
      expect(items()[1].textContent).toContain('created the record');
      expect(more()).toBeNull();
    });

    it('shows an error and keeps the button when loading fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('no', { status: 500 })),
      );
      render(RecordHistory, {
        recordId: 'r1',
        layout,
        history: { entries: [entry({ id: '2' })], nextBefore: '2' },
      });
      more()!.click();
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain('Could not load more history.'),
      );
      expect(items()).toHaveLength(1);
      expect(more()).not.toBeNull();
    });
  });

  it('shows dates in the locale format and relations as titles, hidden ones neutrally', () => {
    render(RecordHistory, {
      recordId: 'r1',
      layout: { fields: [] },
      history: {
        nextBefore: null,
        entries: [
          entry({
            changed: ['date', 'recordId', 'assigneeId', 'creatorId'],
            values: { date: '2026-01-05T00:00:00.000Z' },
            refs: {
              recordId: { kind: 'record', label: null },
              assigneeId: { kind: 'user', label: 'Bob' },
              creatorId: { kind: 'user', label: null },
            },
          }),
        ],
      },
    });
    const text = items()[0].textContent ?? '';
    expect(text).toContain('Jan 5, 2026');
    expect(text).not.toContain('2026-01-05T');
    expect(text).toContain('hidden record');
    expect(text).toContain('Bob');
    expect(text).toContain('Unknown user');
    expect(text).not.toContain('x1');
    expect(text).not.toContain('u1');
  });
});
