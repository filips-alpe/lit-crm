import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import TypesPage from './+page.svelte';

function row(over: Record<string, unknown> = {}) {
  return {
    id: 't1',
    code: 'letter',
    description: null,
    color: '#445566',
    iconSeed: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-05T12:00:00Z'),
    ...over,
  };
}

function renderRows(rows: unknown[]) {
  // Types are admin-write only: the page shows its editing controls to an admin.
  render(TypesPage, { data: { rows, user: { isAdmin: true } } } as never);
}

describe('/types list', () => {
  it('shows each row with its name and created date', async () => {
    renderRows([row()]);
    const item = page.getByRole('listitem').filter({ hasText: 'letter' });
    await expect.element(item).toHaveTextContent(/Created .*2026/);
  });

  it('offers delete on active rows, behind a confirm dialog naming the type', async () => {
    renderRows([row()]);
    await page.getByRole('button', { name: 'Delete letter' }).click();
    const dialog = page.getByRole('dialog');
    await expect.element(dialog).toHaveTextContent(/letter will be moved/);
    const idInput = document.querySelector<HTMLInputElement>('#TypeRowDeleteForm input[name="id"]');
    expect(idInput?.value).toBe('t1');
  });

  it('does not offer row delete on already-deleted rows', async () => {
    renderRows([row({ status: 'INACTIVE' })]);
    await expect
      .element(page.getByRole('button', { name: 'Delete letter' }))
      .not.toBeInTheDocument();
  });
});
