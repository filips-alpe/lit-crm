import { expect, test, type Page } from './fixtures';

// Fixture (prisma/seed.ts): alice is the admin, bob is not. History is written by database
// triggers only for an acting user, so each test makes its own record and edits it with
// app.user_id set (the same setting the app sets per request).

async function loginAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.locator(`button[name="username"][value="${username}"]`).click();
  await expect(page).toHaveURL(/\/$/);
}

const rows = (page: Page) => page.locator('[data-testid="record-history"] li');

test.describe('record history panel', () => {
  test('pages older entries with Load more, newest first', async ({ page, db }) => {
    const [alice, type] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { username: 'alice' } }),
      db.type.findFirstOrThrow({ where: { code: 'invoice' } }),
    ]);
    const rec = await db.record.create({
      data: { typeId: type.id, creatorId: alice.id, title: 'History paging' },
    });
    // 55 saves by alice: one page is 50 rows, so five stay behind "Load more".
    for (let i = 1; i <= 55; i++) {
      await db.$transaction([
        db.$executeRaw`SELECT set_config('app.user_id', ${alice.id}, true)`,
        db.record.update({ where: { id: rec.id }, data: { title: `paging v${i}` } }),
      ]);
    }

    await loginAs(page, 'alice');
    await page.goto(`/data/${rec.id}`);
    await expect(rows(page)).toHaveCount(50);
    await expect(rows(page).first()).toContainText('paging v55');
    await expect(rows(page).last()).toContainText('paging v6');

    await page.getByTestId('history-more').click();
    await expect(rows(page)).toHaveCount(55);
    await expect(rows(page).last()).toContainText('paging v1');
    await expect(page.getByTestId('history-more')).toHaveCount(0);
  });

  test('an admin sees the redaction row, a non-admin does not', async ({ page, db }) => {
    const [alice, bob, type] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { username: 'alice' } }),
      db.user.findUniqueOrThrow({ where: { username: 'bob' } }),
      db.type.findFirstOrThrow({ where: { code: 'invoice' } }),
    ]);
    const rec = await db.record.create({
      data: { typeId: type.id, creatorId: alice.id, title: 'History redact' },
    });
    await db.grant.create({
      data: { userId: bob.id, recordId: rec.id, level: 'READ', hideAmounts: false },
    });
    await db.$transaction([
      db.$executeRaw`SELECT set_config('app.user_id', ${alice.id}, true)`,
      db.record.update({ where: { id: rec.id }, data: { title: 'History redact: secret' } }),
    ]);
    await db.$transaction([
      db.$executeRaw`SELECT set_config('app.user_id', ${alice.id}, true)`,
      db.$executeRaw`SELECT lit_history_redact(${rec.id}, ARRAY['title'])`,
    ]);

    await loginAs(page, 'alice');
    await page.goto(`/data/${rec.id}`);
    await expect(rows(page).first()).toContainText('Alice Example redacted Title');
    await expect(page.locator('[data-action="REDACT"]')).toHaveCount(1);

    await loginAs(page, 'bob');
    await page.goto(`/data/${rec.id}`);
    await expect(page.getByTestId('record-history')).toBeVisible();
    await expect(page.locator('[data-action="REDACT"]')).toHaveCount(0);
    await expect(page.getByText('redacted Title')).toHaveCount(0);
    // the redacted value never reaches a snapshot, the edit itself is still listed
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Alice Example changed Title');
    await expect(rows(page).first()).not.toContainText('secret');
  });
});
