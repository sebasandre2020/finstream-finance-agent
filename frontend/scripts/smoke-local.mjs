import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = process.env.FINSTREAM_URL || 'http://localhost:3000';
  await page.goto(base);
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  const status = await context.request.get(base + '/api/v1/auth/google/status');
  expect((await status.json()).configured).toBe(true);
  expect((await context.request.get(base + '/api/v1/transactions')).status()).toBe(401);
  const login = await context.request.get(base + '/api/v1/auth/google/login', { maxRedirects: 0 });
  expect(login.status()).toBe(303);
  expect(new URL(login.headers().location).hostname).toBe('accounts.google.com');
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/production-signin.png', import.meta.url)), fullPage: true });
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.getByText('Whole Foods Market', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  console.log('Local production check passed: Google configured, authorization redirect valid, anonymous finance access blocked, demo available.');
} finally { await browser.close(); }
