import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page as browserPage } from 'vitest/browser';
import BestPage from './BestPage.svelte';
import type { BestPage as BestPageData } from '$lib/bestPage/assemble';

const data: BestPageData = {
  record: {
    id: 'd1',
    title: 'The Anas',
    typeCode: 'memorandum',
    typeColor: '#8d6e63',
    typeIconSeed: 'pencil',
    date: '1791-08-13',
    description: null,
  },
  sections: [
    {
      kind: 'text',
      label: 'Text',
      segments: [
        { text: 'Th: Jefferson', entityId: 'tj', entityTitle: 'Thomas Jefferson' },
        { text: ' mentioned to him a letter from ' },
        { text: 'John Adams', entityId: 'ja', entityTitle: 'John Adams' },
        { text: '.' },
      ],
    },
    {
      kind: 'sources',
      references: ['https://archive.org/details/writingsofthomas0000vari_v5r4/page/n334'],
    },
  ],
};

describe('BestPage', () => {
  it('renders the text verbatim with mentions as links to entity pages', async () => {
    render(BestPage, { page: data });
    const text = document.querySelector('[data-section="text"] .font-serif');
    expect(text?.textContent).toBe('Th: Jefferson mentioned to him a letter from John Adams.');
    const links = [...document.querySelectorAll('[data-section="text"] a[data-entity]')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Th: Jefferson', '/page/tj'],
      ['John Adams', '/page/ja'],
    ]);
    await expect.element(browserPage.getByRole('heading', { name: 'The Anas' })).toBeVisible();
  });

  it('uses a translated heading when the type has no text field, and tolerates repeated list values', async () => {
    render(BestPage, {
      page: {
        ...data,
        sections: [
          { kind: 'text', label: null, segments: [{ text: 'Body' }] },
          { kind: 'facts', facts: [{ label: 'Tags', value: { kind: 'list', value: ['a', 'a'] } }] },
          { kind: 'sources', references: ['https://x.test/1', 'https://x.test/1'] },
        ],
      },
    });
    await expect.element(browserPage.getByRole('heading', { name: 'Text' })).toBeVisible();
    expect(document.querySelectorAll('[data-section="sources"] li')).toHaveLength(2);
    expect(document.querySelectorAll('[data-section="facts"] li')).toHaveLength(2);
  });

  it('draws only the sections it is given', () => {
    render(BestPage, { page: data });
    expect(
      [...document.querySelectorAll('[data-section]')].map((s) => s.getAttribute('data-section')),
    ).toEqual(['text', 'sources']);
  });
});
