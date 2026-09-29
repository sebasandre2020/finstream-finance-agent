import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/google/status', route => route.fulfill({ json: { configured: true } }));
  await page.route('**/api/v1/stream/events', route => route.abort());
});

test('signed-out users see Google sign-in and can explore a demo without fetching finances', async ({ page }, info) => {
  let requests = 0;
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401 }));
  await page.route('**/api/v1/transactions?**', route => { requests++; return route.fulfill({ status: 401 }); });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute('href', '/api/v1/auth/google/login');
  expect(requests).toBe(0);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: `test-results/google-signin-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.getByText('Whole Foods Market', { exact: true })).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Exit demo' }).click();
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
});

test('signed-in profile can sync Gmail and sign out, clearing financial content', async ({ page }) => {
  let signedIn = true;
  await page.route('**/api/v1/auth/me', route => signedIn ? route.fulfill({ json: { id: 'alice', name: 'Alice', email: 'alice@example.test' } }) : route.fulfill({ status: 401 }));
  await page.route('**/api/v1/transactions?**', route => route.fulfill({ json: { data: [], has_more: false } }));
  await page.route('**/api/v1/auth/google/sync-session', route => route.fulfill({ json: { status: 'success', synced: 3 } }));
  await page.route('**/api/v1/auth/logout', route => { signedIn = false; return route.fulfill({ json: { status: 'signed_out' } }); });
  await page.goto('/');
  await expect(page.getByText('alice@example.test')).toBeVisible();
  await page.getByRole('button', { name: 'Sync Gmail', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('3 new transactions queued');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByText('alice@example.test')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('fin_user_session'))).toBeNull();
});

test('expired session clears dashboard and different users have separate local targets', async ({ page }) => {
  let id = 'alice'; let expired = false;
  await page.route('**/api/v1/auth/me', route => expired ? route.fulfill({ status: 401 }) : route.fulfill({ json: { id, name: id, email: `${id}@example.test` } }));
  await page.route('**/api/v1/transactions?**', route => expired ? route.fulfill({ status: 401 }) : route.fulfill({ json: { data: [], has_more: false } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Set a spending target' }).click();
  await page.getByLabel('Monthly target (USD)').fill('2500');
  await page.getByRole('button', { name: 'Save target' }).click();
  await expect(page.getByRole('button', { name: 'Adjust my target' })).toBeVisible();
  id = 'bob';
  await page.reload();
  await expect(page.getByRole('button', { name: 'Set a spending target' })).toBeVisible();
  expired = true;
  await page.getByRole('button', { name: 'Refresh activity' }).click();
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.locator('.metrics')).toHaveCount(0);
});


test('Gmail sync follows background progress and reports completion or failure', async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { id: 'alice', name: 'Alice', email: 'alice@example.test' } }));
  await page.route('**/api/v1/transactions?**', route => route.fulfill({ json: { data: [], has_more: false } }));
  await page.route('**/api/v1/auth/google/sync-session', route => route.fulfill({ json: { status: 'started' } }));
  let checks = 0;
  let fail = false;
  await page.route('**/api/v1/auth/google/sync-status', route => route.fulfill({ json:
    fail ? { status: 'error' } : ++checks === 1 ? { status: 'syncing' } : { status: 'success', synced: 0, transactions_found: 0 }
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Sync Gmail', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Syncing Gmail' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('No supported bank transaction emails', { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Sync Gmail', exact: true })).toBeEnabled();
  fail = true;
  await page.getByRole('button', { name: 'Sync Gmail', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Gmail sync failed', { timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Sync Gmail', exact: true })).toBeEnabled();
});
