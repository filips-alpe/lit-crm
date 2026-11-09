import { expect, test, type Page } from './fixtures';

// Fixture (prisma/seed.ts): alice is the admin, bob is not. Bob writes project "demo", reads
// "Shared invoice" through the group Auditors (amounts hidden), writes "Open invoice" through
// a grant, and has no access to "Alice private invoice" or the hidden note.

async function loginAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.locator(`button[name="username"][value="${username}"]`).click();
  await expect(page).toHaveURL(/\/$/);
}

// The open-record link of a row is visually hidden; its accessible name ends with the title.
const recordLink = (page: Page, title: string) =>
  page.getByRole('link', { name: new RegExp(`· ${title}$`) });

async function recordHref(page: Page, title: string) {
  await page.goto('/data');
  const link = recordLink(page, title);
  await expect(link).toHaveCount(1);
  return (await link.getAttribute('href'))!.split('?')[0];
}

test.describe('a non-admin under row-level security', () => {
  test('the list shows only what bob may read', async ({ page }) => {
    await loginAs(page, 'bob');
    await page.goto('/data');
    await expect(recordLink(page, 'Shared invoice')).toHaveCount(1);
    await expect(recordLink(page, 'Open invoice')).toHaveCount(1);
    await expect(recordLink(page, 'First note')).toHaveCount(1);
    await expect(page.getByText('Alice private invoice')).toHaveCount(0);
    await expect(page.getByText('Hidden note')).toHaveCount(0);
  });

  test('a record bob cannot read is a 404, not a 500', async ({ page }) => {
    await loginAs(page, 'alice');
    const href = await recordHref(page, 'Alice private invoice');
    await loginAs(page, 'bob');
    const res = await page.goto(href);
    expect(res?.status()).toBe(404);
    await expect(page.getByText('Record not found')).toBeVisible();
  });

  test('a read-only record shows hidden amounts and no Save', async ({ page }) => {
    await loginAs(page, 'bob');
    await page.goto(await recordHref(page, 'Shared invoice'));
    await expect(page.getByText('You can view this record but not change it.')).toBeVisible();
    await expect(page.locator('[data-masked="sum"]')).toContainText('Hidden');
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete record' })).toHaveCount(0);
  });

  test('a writer edits a record, sees the amount', async ({ page }) => {
    await loginAs(page, 'bob');
    await page.goto(await recordHref(page, 'Open invoice'));
    await expect(page.locator('[data-masked]')).toHaveCount(0);
    await expect(page.locator('input[type=number]')).toHaveValue('10');
    const save = async (title: string) => {
      await page.locator('input').first().fill(title);
      const saved = page.waitForResponse((r) => r.url().includes('?/save'));
      await page.getByRole('button', { name: 'Save' }).click();
      expect((await saved).status()).toBe(200);
    };
    await save(`Open invoice ${Date.now() % 1000}`);
    await page.reload();
    await expect(page.locator('input').first()).toHaveValue(/^Open invoice \d+$/);
    await save('Open invoice'); // restore for the other tests
  });

  test('bob has no Admin link, /admin is a 403, and type editing is read-only', async ({
    page,
  }) => {
    await loginAs(page, 'bob');
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    const res = await page.goto('/admin/grants');
    expect(res?.status()).toBe(403);
    await expect(page.getByText('Administrators only.')).toBeVisible();
    expect((await page.goto('/types/new'))?.status()).toBe(403);
    await page.goto('/types');
    await expect(page.getByRole('link', { name: 'Add type' })).toHaveCount(0);
    await page.locator('#TypesList a').first().click();
    await expect(page.getByText('Only administrators can change types.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });
});

test.describe('the admin screen', () => {
  test('alice sees the Admin link and the user list; the last admin cannot be demoted', async ({
    page,
  }) => {
    await loginAs(page, 'alice');
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const row = page.locator('tr[data-username="alice"]');
    await expect(row).toBeVisible();
    await row.getByRole('checkbox').uncheck();
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert')).toContainText('At least one active administrator');
    await page.reload();
    await expect(page.locator('tr[data-username="alice"]').getByRole('checkbox')).toBeChecked();
  });

  test('groups, members and grants: create, change level, delete', async ({ page }) => {
    await loginAs(page, 'alice');
    const name = `e2e-group-${Date.now()}`;

    await page.goto('/admin/groups');
    await page.locator('#GroupCreate input[name="name"]').fill(name);
    await page.locator('#GroupCreate').getByRole('button', { name: 'Add group' }).click();
    const group = page.locator(`li[data-group="${name}"]`);
    await expect(group).toBeVisible();
    // a duplicate name is a form error
    await page.locator('#GroupCreate input[name="name"]').fill(name);
    await page.locator('#GroupCreate').getByRole('button', { name: 'Add group' }).click();
    await expect(page.getByRole('alert')).toContainText('already exists');

    await group.locator('select[name="userId"]').selectOption({ label: 'Bob Example' });
    await group.getByRole('button', { name: 'Add member' }).click();
    await expect(group.getByText('Bob Example')).toBeVisible();

    // a grant to the group: scope type "note", write
    await page.goto('/admin/grants');
    const form = page.locator('#GrantCreate');
    await form.locator('select[name="targetKind"]').selectOption('group');
    await form.locator('select[name="target_group"]').selectOption({ label: name });
    await form.locator('select[name="scopeKind"]').selectOption('type');
    await form.locator('select[name="scope_type"]').selectOption({ label: 'note' });
    await form.locator('select[name="level"]').selectOption('WRITE');
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Add grant' }).click();
    const grantRow = page.locator('#GrantList tr', { hasText: name });
    await expect(grantRow).toContainText('Type: note');
    await expect(grantRow.locator('select[name="level"]')).toHaveValue('WRITE');
    await expect(grantRow.getByRole('checkbox')).toBeChecked();

    // an incomplete grant is refused with a message, not a crash
    await form.locator('select[name="targetKind"]').selectOption('user');
    await form.getByRole('button', { name: 'Add grant' }).click();
    await expect(page.getByRole('alert')).toContainText('Choose who gets access');

    await grantRow.locator('select[name="level"]').selectOption('READ');
    await grantRow.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.locator('#GrantList tr', { hasText: name }).locator('select[name="level"]'),
    ).toHaveValue('READ');
    await page
      .locator('#GrantList tr', { hasText: name })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(page.locator('#GrantList tr', { hasText: name })).toHaveCount(0);

    await page.goto('/admin/groups');
    await page.locator(`li[data-group="${name}"]`).getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator(`li[data-group="${name}"]`)).toHaveCount(0);
  });
});
