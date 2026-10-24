import { expect, test, type Locator, type Page } from '@playwright/test';

const USER = 'bfranklin';

test('list field: add, remove, submit, and record appears on /data', async ({ page }) => {
  await page.context().clearCookies();
  await loginAs(page, USER);

  // 1. Create a Type with two fields: text→note + list→references.
  await page.goto('/types');
  await page.getByRole('link', { name: 'Add type' }).click();

  const code = `LIST-${Date.now()}`;
  await page.locator('input[name="code"]').fill(code);

  // The form seeds one starter field (text→note). Accept a field suggestion
  // to get a second field, then switch its kind to 'list' via the kind menu.
  await page.getByTestId('suggest-accept-title').click();

  const kindButtons = page.locator('[data-testid^="field-kind-"]');
  await expect(kindButtons).toHaveCount(2);
  const secondKind = kindButtons.nth(1);
  await pickKind(secondKind, 'List');

  // Switching to 'list' resets the writeTo to the only list column. There's
  // only one free column for this kind, so it renders as plain text rather
  // than a menu.
  const writeToDisplay = page.locator('[data-testid^="field-writeto-"]').nth(1);
  await expect(writeToDisplay).toHaveAttribute('title', 'Stored in column "references"');

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/types$/);

  // 2. Navigate to /record and pick our new type.
  await page.goto('/record');
  await page.getByRole('link', { name: code }).click();

  // The form renders only after a type with fields is selected.
  await expect(page.locator('input[name="note"]')).toBeVisible();

  // 3. Fill the note (used as the unique marker on /data) and three list values.
  const marker = `marker-${Date.now()}`;
  await page.locator('input[name="note"]').fill(marker);

  const listInput = page.getByTestId('list-input-references');
  for (const value of ['id-one', 'id-two', 'id-three']) {
    await listInput.fill(value);
    await listInput.press('Enter');
    await expect(listInput).toHaveValue('');
  }

  await expect(page.getByTestId('list-chip-references-0')).toContainText('id-one');
  await expect(page.getByTestId('list-chip-references-1')).toContainText('id-two');
  await expect(page.getByTestId('list-chip-references-2')).toContainText('id-three');

  // Remove the middle chip; the other two slide down by index.
  await page.getByTestId('list-chip-remove-references-1').click();
  await expect(page.getByTestId('list-chip-references-2')).toBeHidden();
  await expect(page.getByTestId('list-chip-references-0')).toContainText('id-one');
  await expect(page.getByTestId('list-chip-references-1')).toContainText('id-three');

  // 4. Submit the record — await the POST so navigation doesn't race the save.
  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/record') &&
        resp.request().method() === 'POST' &&
        resp.status() === 200,
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);

  // 5. Confirm the record appears on /data, matched by the unique note
  // marker. Each row carries an "Open <type> · <title or note>" link (card/row
  // components, not a <table>), so match on that accessible name.
  await page.goto('/data');
  await expect(page.getByRole('link', { name: new RegExp(`^Open .*${marker}$`) })).toHaveCount(1);
});

// The kind control is a custom dropdown (button + role="menu"), not a native
// <select>.
function kindMenu(kindButton: Locator): Locator {
  return kindButton.locator('xpath=..');
}

async function pickKind(kindButton: Locator, label: string) {
  await kindButton.click();
  await kindMenu(kindButton)
    .getByRole('menuitemradio', { name: new RegExp(`^${label}\\b`) })
    .click();
}

async function loginAs(page: Page, username: string) {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login$/);
  await page.locator(`label:has(input[name="username"][value="${username}"])`).click();
  await expect(page).toHaveURL(/\/$/);
}
