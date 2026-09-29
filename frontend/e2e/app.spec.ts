import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { id: 'test-user', name: 'Test User', email: 'test@example.test' } }));
  await page.route('**/api/v1/auth/google/status', route => route.fulfill({ json: { configured: true } }));
  await page.route('**/api/v1/transactions?**', route => route.fulfill({ json: { data: [], has_more: false, next_cursor: null } }));
  await page.route('**/api/v1/stream/events', route => route.abort());
});
async function demo(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore a demo' }).click();
}
test('demo overview is responsive, accessible, and has no runtime errors', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await demo(page);
  await expect(page.getByText('$1,772.01').first()).toBeVisible();
  await expect(page.getByText('Whole Foods Market')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/overview-${info.project.name}.png`, fullPage: true });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  expect(errors).toEqual([]);
});
test('activity search, filters, details, privacy and CSV export work', async ({ page }) => {
  await demo(page);
  await page.getByRole('button', { name: 'View all activity' }).click();
  await page.getByRole('textbox', { name: 'Search activity' }).fill('coffee');
  await expect(page.getByText('Blue Bottle Coffee', { exact: true })).toBeVisible();
  await expect(page.getByText('Whole Foods Market', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Blue Bottle Coffee/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Hide amounts' }).click();
  await expect(page.getByText('−••••', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show amounts' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('finstream-sample-activity.csv');
  const stream = await download.createReadStream();
  let csv = ''; for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain('Blue Bottle Coffee'); expect(csv).not.toContain('Whole Foods Market');
  await page.getByRole('textbox', { name: 'Search activity' }).fill('');
  await page.getByRole('combobox', { name: 'Money direction' }).selectOption('in');
  await expect(page.getByText('Monthly paycheck', { exact: true })).toBeVisible();
  await expect(page.getByText('Blue Bottle Coffee', { exact: true })).toHaveCount(0);
});
test('spending target and review state persist across reloads, with demo isolation', async ({ page }) => {
  await demo(page);
  await page.getByRole('button', { name: 'Set a spending target' }).click();
  await page.getByLabel('Monthly target (USD)').fill('2500');
  await page.getByRole('button', { name: 'Save target' }).click();
  await expect(page.locator('.target-value')).toContainText('$727.99');
  await page.getByRole('navigation').getByRole('button', { name: /To review/ }).click();
  await page.getByRole('button', { name: 'Mark as reviewed' }).click();
  await expect(page.getByText('You’re all caught up')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Set a spending target' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.locator('.target-value')).toContainText('$727.99');
  await page.getByRole('navigation').getByRole('button', { name: /To review/ }).click();
  await expect(page.getByText('You’re all caught up')).toBeVisible();
});
test('failed loading can be retried without showing misleading fake data', async ({ page }) => {
  let failed = true;
  await page.route('**/api/v1/transactions?**', route => failed ? route.fulfill({ status: 503, body: 'offline' }) : route.fulfill({ json: { data: [], has_more: false } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('couldn’t load');
  failed = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Welcome to a clearer money routine')).toBeVisible();
});
test('real API decimal contract, currency separation and older history', async ({ page }) => {
  const base = { id: 'a', account_id: 'account-usd', institution_name: 'Test bank', amount: '10.25', currency: 'USD', category: 'Groceries', raw_description: 'SHOP', normalized_merchant: 'Local shop', transaction_time: new Date().toISOString(), is_anomaly: false };
  await page.route('**/api/v1/transactions?**', route => route.fulfill({ json: route.request().url().includes('cursor=') ? { data: [{ ...base, id: 'older', amount: '5.25', normalized_merchant: 'Older shop' }], has_more: false } : { data: [base, { ...base, id: 'eur', account_id: 'account-eur', currency: 'EUR', amount: '100.00', normalized_merchant: 'Euro shop' }], has_more: true, next_cursor: 'next' } }));
  await page.goto('/');
  await expect(page.locator('.metric.featured')).toContainText('$10.25');
  await page.getByRole('button', { name: 'Load older activity' }).click();
  await expect(page.locator('.metric.featured')).toContainText('$15.50');
  await expect(page.getByRole('button', { name: 'Load older activity' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Currency' }).selectOption('EUR');
  await expect(page.locator('.metric.featured')).toContainText('100.00');
  await expect(page.getByText('Local shop', { exact: true })).toHaveCount(0);
});



test('all sections fit narrow and tablet screens and dialogs support keyboard dismissal', async ({ page }) => {
  await demo(page);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Overview', 'Activity', 'Spending plan', 'To review']) {
      await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
    }
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Spending plan', exact: true }).click();
  await page.getByRole('button', { name: 'Set a spending target' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Set a spending target' })).toBeFocused();
});

