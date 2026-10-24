import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { defaults } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import RecordDetail from './RecordDetail.svelte';
import { buildLayoutSchema, valuesFromRecord, type FormLayout } from '$lib/forms/layout';
import type { RendererDetailThread } from '$lib/render/props';

const letterLayout: FormLayout = {
  fields: [
    { id: 'title', label: 'Subject', kind: 'text', writeTo: 'title' },
    { id: 'text', label: 'Body', kind: 'text', writeTo: 'text' },
    { id: 'from', label: 'From', kind: 'text', writeTo: 'from' },
    { id: 'to', label: 'To', kind: 'text', writeTo: 'to' },
    { id: 'fromGeo', label: 'From coords', kind: 'location', writeTo: 'fromGeo' },
    { id: 'toGeo', label: 'To coords', kind: 'location', writeTo: 'toGeo' },
  ],
};

// A layout whose recipient/sender are People (creatorId/assigneeId) rather
// than plain text — e.g. the seeded `toUser` letters.
const letterWithPeopleLayout: FormLayout = {
  fields: [
    ...letterLayout.fields,
    { id: 'fromUser', label: 'From (person)', kind: 'user', writeTo: 'creatorId' },
    { id: 'toUser', label: 'To (person)', kind: 'user', writeTo: 'assigneeId' },
  ],
};

const plainLayout: FormLayout = {
  fields: [{ id: 'note', label: 'Note', kind: 'text', writeTo: 'note' }],
};

const SOLO: RendererDetailThread = { prevId: null, nextId: null, position: 1, total: 1 };

function build(
  layout: FormLayout,
  rendererId: string | null,
  record: Record<string, unknown>,
  thread: RendererDetailThread = SOLO,
) {
  const full = {
    id: 'r1',
    createdAt: '2026-01-01T00:00:00Z',
    status: 'ACTIVE',
    creator: null,
    ...record,
  };
  return {
    record: full,
    type: { id: 't1', code: 'LTR', color: '#334155', iconSeed: null, rendererId, layout },
    form: defaults(valuesFromRecord(layout, full), zod4(buildLayoutSchema(layout))),
    layout,
    thread,
  };
}

describe('RecordDetail', () => {
  it('renders the bespoke letter detail with a route map for a correspondence type', async () => {
    render(
      RecordDetail,
      build(letterLayout, 'correspondence', {
        title: 'Treaty',
        text: 'Dear friend',
        from: 'A',
        to: 'B',
        fromGeo: '51.5,-0.1',
        toGeo: '42.36,-71.06',
      }),
    );
    // Body is editable, so its value lives in an input — assert the label + map.
    await expect.element(page.getByText('Subject')).toBeInTheDocument();
    // The route map renders an inline SVG.
    expect(document.querySelector('svg')).not.toBeNull();
  });

  it('plots other located letters on the map as clickable paths', async () => {
    render(RecordDetail, {
      ...build(letterLayout, 'correspondence', {
        title: 'Treaty',
        text: 'Dear friend',
        from: 'A',
        to: 'B',
        fromGeo: '51.5,-0.1',
        toGeo: '42.36,-71.06',
      }),
      letters: [
        {
          id: 'r1',
          from: 'A',
          to: 'B',
          fromGeo: '51.5,-0.1',
          toGeo: '42.36,-71.06',
          title: 'Treaty',
        },
        {
          id: 'other',
          from: 'C',
          to: 'A',
          fromGeo: '48.85,2.35',
          toGeo: '51.5,-0.1',
          title: 'Reply',
        },
      ],
    });
    await expect
      .element(page.getByText('+1 more on the map — click a path to open.'))
      .toBeInTheDocument();
    const link = document.querySelector('a[aria-label="Open letter: C → A"]');
    expect(link?.getAttribute('href')).toBe('/data/other');
  });

  it('omits the map when the letter has no coordinates', async () => {
    render(
      RecordDetail,
      build(letterLayout, 'correspondence', { title: 'No route', text: 'x', from: 'A', to: 'B' }),
    );
    await expect
      .element(page.getByText('No route — add coordinates below to draw the map.'))
      .toBeInTheDocument();
  });

  it('hides the thread bar for a single-letter correspondence', async () => {
    render(
      RecordDetail,
      build(letterLayout, 'correspondence', { title: 'Solo', text: 'x', from: 'A', to: 'B' }),
    );
    await expect.element(page.getByText('Subject')).toBeInTheDocument();
    await expect.element(page.getByText('1 of 1')).not.toBeInTheDocument();
  });

  it('shows the thread bar with position and links when no onNavigate (page mode)', async () => {
    render(
      RecordDetail,
      build(
        letterLayout,
        'correspondence',
        { title: 'Mid', text: 'x', from: 'A', to: 'B' },
        {
          prevId: 'older',
          nextId: null,
          position: 2,
          total: 3,
        },
      ),
    );
    await expect.element(page.getByText('2 of 3')).toBeInTheDocument();
    await expect
      .element(page.getByRole('link', { name: '← Previous' }))
      .toHaveAttribute('href', '/data/older');
    // No nextId → inert text, not a link.
    await expect.element(page.getByRole('link', { name: 'Next →' })).not.toBeInTheDocument();
  });

  it('renders thread controls as buttons that call onNavigate in modal mode', async () => {
    const onNavigate = vi.fn();
    render(RecordDetail, {
      ...build(
        letterLayout,
        'correspondence',
        { title: 'Mid', text: 'x', from: 'A', to: 'B' },
        {
          prevId: 'older',
          nextId: 'newer',
          position: 2,
          total: 3,
        },
      ),
      onNavigate,
    });
    await page.getByRole('button', { name: '← Previous' }).click();
    expect(onNavigate).toHaveBeenCalledWith('older');
  });

  it('falls back to the generic field detail (no thread bar, no map) without a renderer', async () => {
    render(RecordDetail, build(plainLayout, null, { note: 'plain note' }));
    await expect.element(page.getByText('Note')).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeNull();
  });

  it('renders the From/To person fields when the layout places creatorId/assigneeId', async () => {
    render(RecordDetail, {
      ...build(letterWithPeopleLayout, 'correspondence', {
        title: 'Treaty',
        text: 'Dear friend',
        from: 'A',
        to: 'B',
        creatorId: 'u1',
        assigneeId: 'u2',
      }),
      options: {
        users: [
          {
            id: 'u1',
            name: 'Benjamin Franklin',
            username: 'bfranklin',
            color: '#000',
            avatarSeed: null,
          },
          { id: 'u2', name: 'David Hume', username: 'dhume', color: '#111', avatarSeed: null },
        ],
        records: [],
        projects: [],
      },
    });
    await expect.element(page.getByText('From (person)')).toBeInTheDocument();
    await expect.element(page.getByText('To (person)')).toBeInTheDocument();
    await expect
      .element(page.getByRole('option', { name: 'Benjamin Franklin' }).first())
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('option', { name: 'David Hume' }).first())
      .toBeInTheDocument();
  });
});
