import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import RecordCard from './RecordCard.svelte';

const layout = { fields: [{ id: 'who', label: 'Who', kind: 'text' as const, writeTo: 'title' }] };
const baseType = { code: 't', color: '#123456', iconSeed: null, layout };
const baseRow = { id: '1', createdAt: '2026-01-01T00:00:00Z', status: 'ACTIVE', title: 'Acme' };

describe('RecordCard renderer selection', () => {
  it('renders the default field markup when the type has no renderer', async () => {
    render(RecordCard, { row: baseRow, type: baseType });
    await expect.element(page.getByText('Who')).toBeInTheDocument();
    await expect.element(page.getByText('Acme')).toBeInTheDocument();
  });

  it('renders the selected installed renderer when rendererId is set', async () => {
    render(RecordCard, { row: baseRow, type: { ...baseType, rendererId: 'headline' } });
    // The headline renderer shows the value but not the default uppercase label.
    await expect.element(page.getByText('Acme')).toBeInTheDocument();
    await expect.element(page.getByText('Who')).not.toBeInTheDocument();
  });

  it('shows project chips for the record’s membership', async () => {
    render(RecordCard, {
      row: {
        ...baseRow,
        projects: [
          { projectId: 'p1', project: { id: 'p1', code: 'Imprimerie', color: '#3366cc' } },
        ],
      },
      type: baseType,
    });
    await expect.element(page.getByText('Imprimerie')).toBeInTheDocument();
  });

  it('renders fields that share a label and list items that repeat', async () => {
    render(RecordCard, {
      row: { ...baseRow, title: 'Acme', description: 'Beta', references: ['a', 'a'] },
      type: {
        ...baseType,
        layout: {
          fields: [
            { id: 'one', label: 'Name', kind: 'text' as const, writeTo: 'title' },
            { id: 'two', label: 'Name', kind: 'text' as const, writeTo: 'description' },
            { id: 'tags', label: 'Tags', kind: 'list' as const, writeTo: 'references' },
          ],
        },
      },
    });
    await expect.element(page.getByText('Acme')).toBeInTheDocument();
    await expect.element(page.getByText('Beta')).toBeInTheDocument();
    expect(document.querySelectorAll('span.rounded.bg-stone-100')).toHaveLength(2);
  });
});
