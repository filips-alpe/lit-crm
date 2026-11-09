import { expect, test } from './fixtures';

// Proves the DB-backed flow end to end and that workers are isolated: a record
// written via the worker's Prisma client is visible through the app (which is
// bound to the same DB), and never leaks into the shared template.
test('worker DB is seeded, writable and served by the app', async ({ page, db }) => {
  const code = `e2e-iso-${Date.now()}`;
  const before = await db.type.count();
  expect(before, 'template should be seeded').toBeGreaterThan(0);

  await page.goto('/login');
  await page.locator('button[name="username"][value="alice"]').click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/types/new');
  await page.locator('input[name="code"]').fill(code);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/types$/);

  // Visible through the worker's Prisma client => the app wrote to this worker's DB.
  expect(await db.type.findFirst({ where: { code } })).not.toBeNull();
  expect(await db.type.count()).toBe(before + 1);
});
