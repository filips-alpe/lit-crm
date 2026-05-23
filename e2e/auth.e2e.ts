import { expect, test, type Page } from '@playwright/test';

const USER_A = 'bfranklin';
const USER_B = 'dfranklin';

test('login → logout → login as different user → logout', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  await loginAs(page, USER_A);
  await logout(page);

  await loginAs(page, USER_B);
  await logout(page);
});

async function loginAs(page: Page, username: string) {
  await expect(page).toHaveURL(/\/login$/);
  await page.locator(`label:has(input[name="username"][value="${username}"])`).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(username, { exact: false })).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}
