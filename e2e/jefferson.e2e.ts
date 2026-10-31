import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

// Runs against a database seeded with the full seed (`bunx prisma db seed`), which includes the
// Jefferson corpus. Everything asserted is read from the generated pipeline output, not hardcoded.
const dir = 'prisma/seed/generated/jefferson/';
const read = <T>(f: string) => JSON.parse(readFileSync(dir + f, 'utf8')) as T;
type Rec = { key: string; type: string; title: string; text: string };
type Men = { recordKey: string; entityKey: string; start: number; end: number; surface: string };
type Ent = { key: string; title: string; type: string };

const records = read<Rec[]>('records.json');
const entities = read<Ent[]>('entities.json');
const mentions = read<Men[]>('mentions.json');

// A source record with at least two different linked entities, and the first mention in it.
const target = (() => {
  for (const r of records) {
    const ms = mentions.filter((m) => m.recordKey === r.key);
    if (r.type === 'query' && new Set(ms.map((m) => m.entityKey)).size >= 2) return { r, ms };
  }
  throw new Error('no suitable record in the generated data');
})();
const first = target.ms[0];
const entity = entities.find((e) => e.key === first.entityKey)!;

async function loginAs(page: Page, username: string) {
  await page.goto('/login');
  await page.locator(`button[name="username"][value="${username}"]`).click();
  await expect(page).toHaveURL(/\/$/);
}

/** The visible content of a best page, as text, with the section headings it shows. */
async function bestPageContent(page: Page) {
  const root = page.getByTestId('best-page');
  await expect(root).toBeVisible();
  const sections = await root
    .locator('[data-section]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-section')));
  return { text: (await root.innerText()).replace(/\s+/g, ' ').trim(), sections };
}

async function withoutJs(browser: Browser, page: Page) {
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
    baseURL: 'http://localhost:4173',
  });
  return { ctx, page: await ctx.newPage() };
}

test('a mention links to its entity page; SSR load equals client navigation; text is unchanged', async ({
  page,
  browser,
}) => {
  await page.context().clearCookies();
  await loginAs(page, 'bfranklin');

  // The record shows its text exactly as stored, with the mention as a link.
  await page.goto(`/data/${target.r.key}`);
  const body = page.locator('.annotated-text');
  await expect(body).toBeVisible();
  expect(await body.textContent()).toBe(target.r.text);
  const link = body.locator(`a[href$="/entity/${entity.key}"]`).first();
  await expect(link).toHaveText(first.surface);

  // Client navigation: click the link (no full page load).
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/entity/${entity.key}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(entity.title);
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
  const viaClick = await bestPageContent(page);

  // Direct load with JS (SSR + hydration) and without JS (pure SSR) show the same content.
  await page.goto(`/entity/${entity.key}`);
  const direct = await bestPageContent(page);
  expect(direct).toEqual(viaClick);

  const nojs = await withoutJs(browser, page);
  await nojs.page.goto(`/entity/${entity.key}`);
  const ssr = await bestPageContent(nojs.page);
  await nojs.ctx.close();
  expect(ssr).toEqual(viaClick);

  // The entity page lists this record among the places it is mentioned.
  expect(viaClick.sections).toContain('mentions');
  expect(viaClick.sections).toContain('sources');
  expect(viaClick.text).toContain(target.r.title);
});

test('a source record page omits the sections it has no data for', async ({ page }) => {
  await page.context().clearCookies();
  await loginAs(page, 'bfranklin');

  await page.goto(`/entity/${target.r.key}`);
  const { sections } = await bestPageContent(page);
  // A record that is mentioned nowhere has no mention contexts, variants or sources...
  for (const absent of ['mentions', 'variants', 'sources']) expect(sections).not.toContain(absent);
  // ...but it does show the entities it names.
  expect(sections).toContain('mentioned');
  await expect(page.locator('[data-section="mentions"]')).toHaveCount(0);

  // An entity has no "named in this record" section.
  await page.goto(`/entity/${entity.key}`);
  expect((await bestPageContent(page)).sections).not.toContain('mentioned');
});

test('an unknown id is a 404', async ({ page }) => {
  await page.context().clearCookies();
  await loginAs(page, 'bfranklin');
  const res = await page.goto('/entity/does-not-exist');
  expect(res?.status()).toBe(404);
});

test('mention contexts paginate with plain links', async ({ page }) => {
  await page.context().clearCookies();
  await loginAs(page, 'bfranklin');
  const counts = new Map<string, number>();
  for (const m of mentions) counts.set(m.entityKey, (counts.get(m.entityKey) ?? 0) + 1);
  const [busy, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
  expect(n).toBeGreaterThan(50);

  await page.goto(`/entity/${busy}`);
  await expect(page.locator('[data-section="mentions"] li')).toHaveCount(50);
  const next = page.getByRole('link', { name: 'Next page' });
  await expect(next).toHaveAttribute('href', `/entity/${busy}?page=2`);
  await next.click();
  await expect(page).toHaveURL(new RegExp(`\\?page=2$`));
  await expect(page.locator('[data-section="mentions"] li').first()).toBeVisible();
});

test('opening a record in the /data modal carries its links, and following one leaves the modal', async ({
  page,
}) => {
  await page.context().clearCookies();
  await loginAs(page, 'bfranklin');

  await page.goto('/data');
  await page.getByRole('link', { name: 'query query', exact: true }).first().click();
  await expect(page).toHaveURL(/type=/);
  // The row link of a Jefferson query record opens the modal (shallow route).
  // The row's own link is a stretched overlay; a click on the row body opens the record.
  await page.getByRole('link', { name: `Open query · ${target.r.title}` }).click({ force: true });
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/data/${target.r.key}`));

  const link = dialog.locator(`.annotated-text a[href$="/entity/${entity.key}"]`).first();
  await expect(link).toHaveText(first.surface);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/entity/${entity.key}$`));
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(entity.title);
});
