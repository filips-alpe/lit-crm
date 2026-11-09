import { expect, test, type Locator, type Page } from './fixtures';

const USER = 'alice';

test('creating a type persists the picked color and icon', async ({ page }) => {
  await page.context().clearCookies();
  await loginAs(page, USER);

  await page.goto('/types');
  await expect(page).toHaveURL(/\/types$/);

  await page.getByRole('link', { name: 'Add type' }).click();
  await expect(page).toHaveURL(/\/types\/new$/);

  const code = `e2e-${Date.now()}`;
  await page.locator('input[name="code"]').fill(code);

  // Pick a specific color from the palette (amber). Swatches are a radiogroup,
  // not plain buttons.
  const colorHex = '#f59e0b';
  await page.getByRole('radio', { name: colorHex }).click();

  // Icons live behind the "Change icon" dialog. Scope the icon-grid locator
  // to the dialog — the "Change icon" trigger itself also has an
  // aria-label and contains an <img>, so an unscoped query would match it.
  await page.getByRole('button', { name: 'Change icon' }).click();
  const iconButtons = page.locator('dialog button[aria-label]:has(img[alt])');
  // Pick the second icon in the grid (the first is the default selection,
  // so changing to the second proves the picker actually wrote the value).
  // The seed is read off the option's own badge image rather than its
  // (humanized) aria-label; badges are local data: SVGs, so they carry the raw
  // seed and colour as data-icon / data-color.
  const targetIcon = iconButtons.nth(1);
  const iconName = await targetIcon.locator('img').getAttribute('data-icon');
  expect(iconName, 'icon option should render a badge with a data-icon seed').toBeTruthy();
  await targetIcon.click();

  await page.getByRole('button', { name: 'Save' }).click();

  // After save the server redirects back to /types.
  await expect(page).toHaveURL(/\/types$/);

  // The new row appears in the list with a badge that uses the picked
  // icon AND background color.
  const newRow = page.locator('#TypesList li', { hasText: code });
  await expect(newRow).toBeVisible();

  const badgeImg = newRow.locator('img');
  expect(await badgeImg.getAttribute('src'), 'badge should be a local SVG').toMatch(
    /^data:image\/svg\+xml/,
  );
  await expect(badgeImg).toHaveAttribute('data-icon', iconName!);
  await expect(badgeImg).toHaveAttribute('data-color', colorHex);
});

test('list kind is disabled on other fields once one field has kind=list', async ({ page }) => {
  await page.context().clearCookies();
  await loginAs(page, USER);

  await page.goto('/types/new');
  await expect(page).toHaveURL(/\/types\/new$/);

  // The new-type form seeds with one starter field (text -> note). Accept a
  // field suggestion to get a second field so we have two to compare
  // against. Suggestions are padded deterministically with every free
  // column, so "Title" is always offered here.
  await page.getByTestId('suggest-accept-title').click();

  const kindButtons = page.locator('[data-testid^="field-kind-"]');
  await expect(kindButtons).toHaveCount(2);
  const firstKind = kindButtons.nth(0);
  const secondKind = kindButtons.nth(1);

  // Initially both fields default to text/number columns — list (the only
  // "references" column) is selectable from either field's kind menu.
  await expect(await openListMenuItem(secondKind)).toBeEnabled();
  await closeMenu(secondKind);

  // Flip the first field to kind=list.
  await pickKind(firstKind, 'List');

  // The second field's list option must now be disabled (only one
  // "references" column exists, so a second list field would collide).
  await expect(await openListMenuItem(secondKind)).toBeDisabled();
  await closeMenu(secondKind);

  // The first field — the one that already has list — keeps the option
  // enabled so it can render its current value and be switched away.
  await expect(await openListMenuItem(firstKind)).toBeEnabled();
  await closeMenu(firstKind);

  // Switching the first field back to text re-opens list on the second.
  await pickKind(firstKind, 'Text');
  await expect(await openListMenuItem(secondKind)).toBeEnabled();
  await closeMenu(secondKind);
});

test('a type can be created, renamed and deleted', async ({ page }) => {
  await page.context().clearCookies();
  await loginAs(page, USER);

  // Create
  const code = `crud-${Date.now()}`;
  await page.goto('/types/new');
  await page.locator('input[name="code"]').fill(code);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/types$/);

  // The new row shows its name and created date
  const row = page.locator('#TypesList li', { hasText: code });
  await expect(row).toContainText(/Created .*\d{4}/);

  // Edit (rename)
  const renamed = `${code}-renamed`;
  await row.getByRole('link').click();
  await expect(page).toHaveURL(/\/types\/[^/]+$/);
  await page.locator('input[name="code"]').fill(renamed);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/types$/);
  const renamedRow = page.locator('#TypesList li', { hasText: renamed });
  await expect(renamedRow).toBeVisible();

  // Delete from the row: confirm, stay on the list, row is marked deleted
  await renamedRow.getByRole('button', { name: `Delete ${renamed}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/types$/);
  await expect(renamedRow).toContainText('deleted');
  await expect(renamedRow.getByRole('button', { name: `Delete ${renamed}` })).toHaveCount(0);
});

// The kind control is a custom dropdown (button + role="menu"), not a native
// <select>. Each field's menu is scoped under its own dropdown container so
// identically-labelled items in other fields' menus aren't matched.
function kindMenu(kindButton: Locator): Locator {
  return kindButton.locator('xpath=..');
}

function listMenuItem(kindButton: Locator): Locator {
  return kindMenu(kindButton).getByRole('menuitemradio', { name: /^List\b/ });
}

async function openListMenuItem(kindButton: Locator): Promise<Locator> {
  await kindButton.click();
  return listMenuItem(kindButton);
}

async function pickKind(kindButton: Locator, label: string) {
  await kindButton.click();
  await kindMenu(kindButton)
    .getByRole('menuitemradio', { name: new RegExp(`^${label}\\b`) })
    .click();
}

async function closeMenu(kindButton: Locator) {
  // The dropdown is a CSS :focus-within trick on the trigger button, not a
  // native <dialog> — Escape doesn't blur it, so blur explicitly before the
  // next field's menu is opened (otherwise it keeps covering the page and
  // intercepts later clicks).
  await kindButton.evaluate((el) => (el as HTMLElement).blur());
}

async function loginAs(page: Page, username: string) {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login$/);
  await page.locator(`button[name="username"][value="${username}"]`).click();
  await expect(page).toHaveURL(/\/$/);
}
