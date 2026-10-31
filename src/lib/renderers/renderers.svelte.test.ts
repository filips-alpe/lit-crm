import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { RendererFieldValue, RendererProps } from '$lib/render/props';
import { getRenderer } from './registry';
import AmountCard from './amount/AmountCard.svelte';
import CorrespondenceCard from './correspondence/CorrespondenceCard.svelte';
import AirMailCard from './airmail/AirMailCard.svelte';
import EventCard from './event/EventCard.svelte';
import PublicationCard from './publication/PublicationCard.svelte';

function f(over: Partial<RendererFieldValue> & { writeTo: string }): RendererFieldValue {
  return { label: over.writeTo, kind: 'text', value: over.writeTo, raw: over.writeTo, ...over };
}

function props(fields: Record<string, RendererFieldValue>): RendererProps {
  return {
    fields,
    createdAt: '2026-01-01T00:00:00Z',
    status: 'ACTIVE',
    creator: null,
    projects: [],
    type: { code: 't', color: '#000', iconSeed: null },
  };
}

describe('amount renderer', () => {
  it('leads with the amount and shows title + counterparty', async () => {
    render(
      AmountCard,
      props({
        amount: f({ writeTo: 'sum', kind: 'number', value: '€1,200' }),
        title: f({ writeTo: 'title', value: 'Press paper' }),
        party: f({ writeTo: 'to', value: 'The Courant' }),
      }),
    );
    await expect.element(page.getByText('€1,200')).toBeInTheDocument();
    await expect.element(page.getByText('Press paper')).toBeInTheDocument();
    await expect.element(page.getByText('→ The Courant')).toBeInTheDocument();
  });

  it('falls back to the title when there is no amount', async () => {
    render(AmountCard, props({ title: f({ writeTo: 'title', value: 'Just a title' }) }));
    await expect.element(page.getByText('Just a title')).toBeInTheDocument();
  });
});

describe('correspondence renderer', () => {
  it('shows the recipient as a clickable person chip linking to the filter', async () => {
    render(
      CorrespondenceCard,
      props({
        from: f({ writeTo: 'from', value: 'B. Franklin' }),
        to: f({ writeTo: 'to', value: 'D. Hume' }),
        title: f({ writeTo: 'title', value: 'On miracles' }),
      }),
    );
    await expect.element(page.getByText('D. Hume')).toBeInTheDocument();
    await expect.element(page.getByText('On miracles')).toBeInTheDocument();
    const link = page.getByRole('link', { name: 'D. Hume' });
    await expect.element(link).toBeInTheDocument();
    await expect.element(link).toHaveAttribute('href', expect.stringContaining('correspondent='));
  });

  it('falls back to em dash when nothing is present', async () => {
    render(CorrespondenceCard, props({}));
    await expect.element(page.getByText('—')).toBeInTheDocument();
  });

  it('draws the route map with a From → To caption when coordinates are present', async () => {
    render(
      CorrespondenceCard,
      props({
        from: f({ writeTo: 'from', value: 'B. Franklin' }),
        to: f({ writeTo: 'to', value: 'D. Hume' }),
        fromGeo: f({ writeTo: 'fromGeo', kind: 'location', value: '51.5, -0.1', raw: '51.5,-0.1' }),
        toGeo: f({
          writeTo: 'toGeo',
          kind: 'location',
          value: '42.36, -71.06',
          raw: '42.36,-71.06',
        }),
      }),
    );
    await expect.element(page.getByText('B. Franklin → D. Hume')).toBeInTheDocument();
  });
});

describe('air mail renderer', () => {
  it('shows both sender and recipient with From/To labels', async () => {
    render(
      AirMailCard,
      props({
        from: f({ writeTo: 'from', value: 'B. Franklin' }),
        to: f({ writeTo: 'to', value: 'D. Hume' }),
        title: f({ writeTo: 'title', value: 'On miracles' }),
      }),
    );
    await expect.element(page.getByText('From')).toBeInTheDocument();
    await expect.element(page.getByText('To')).toBeInTheDocument();
    await expect.element(page.getByText('B. Franklin')).toBeInTheDocument();
    await expect.element(page.getByText('D. Hume')).toBeInTheDocument();
  });
});

describe('event renderer', () => {
  it('leads with the title and shows the calendar day + where', async () => {
    render(
      EventCard,
      props({
        title: f({ writeTo: 'title', value: 'Treaty signed' }),
        date: f({
          writeTo: 'date',
          kind: 'date',
          value: '6 Feb 1778',
          raw: '1778-02-15T12:00:00.000Z',
        }),
        place: f({ writeTo: 'to', value: 'Paris' }),
      }),
    );
    await expect.element(page.getByText('Treaty signed')).toBeInTheDocument();
    await expect.element(page.getByText('Feb')).toBeInTheDocument();
    await expect.element(page.getByText('Paris', { exact: false })).toBeInTheDocument();
  });
});

describe('publication renderer', () => {
  it('quotes the title and shows the byline', async () => {
    render(
      PublicationCard,
      props({
        title: f({ writeTo: 'title', value: 'Silence Dogood' }),
        pen: f({ writeTo: 'from', value: 'Mrs. Silence Dogood' }),
      }),
    );
    await expect.element(page.getByText('“Silence Dogood”')).toBeInTheDocument();
    await expect.element(page.getByText('as Mrs. Silence Dogood')).toBeInTheDocument();
  });
});

describe('registry wiring', () => {
  it('exposes every new renderer with a card and row', () => {
    for (const id of ['amount', 'correspondence', 'event', 'publication']) {
      const r = getRenderer(id);
      expect(r, id).not.toBeNull();
      expect(r?.card, id).toBeTruthy();
      expect(r?.row, id).toBeTruthy();
    }
  });
});

describe('source-text renderer', () => {
  it('is registered with a card, row and detail', () => {
    const r = getRenderer('source-text');
    expect(r?.card).toBeDefined();
    expect(r?.row).toBeDefined();
    expect(r?.detail).toBeDefined();
  });

  it('leads with the title and shows the opening of the text', async () => {
    const r = getRenderer('source-text')!;
    render(
      r.card!,
      props({
        title: f({ writeTo: 'title', value: 'Query XVIII' }),
        body: f({
          writeTo: 'text',
          kind: 'markdown',
          value: 'The manners…',
          raw: 'The manners of the people',
        }),
      }),
    );
    await expect.element(page.getByText('Query XVIII')).toBeInTheDocument();
    await expect.element(page.getByText('The manners of the people')).toBeInTheDocument();
  });
});
