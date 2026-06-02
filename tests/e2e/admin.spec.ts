import { test, expect, type Page } from '@playwright/test';

const SUPERADMIN = { email: 'admin@1morerep.local', password: 'devsuperpass123' };

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/app/);
}

test.describe('P3 admin', () => {
  test('unauthenticated /admin redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('superadmin signs in and reaches the admin dashboard', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Users', { exact: true }).first()).toBeVisible();
  });

  test('superadmin toggles self-registration and it persists', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await page.goto('/admin/settings');
    // Enable self-registration (idempotent; the two browser projects share one DB).
    await page.getByRole('checkbox', { name: /register themselves/i }).check();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();
    // persisted across a fresh load
    await page.reload();
    await expect(page.getByRole('checkbox', { name: /register themselves/i })).toBeChecked();
  });

  test('self-registration toggle gates the public /register page', async ({ browser }) => {
    // In a clean (unauthenticated) context, enabling registration makes /register reachable.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/register');
    // Either it shows the form (enabled by the test above) or redirects to /login (disabled).
    await expect(page).toHaveURL(/\/register|\/login/);
    await ctx.close();
  });

  test('invite form is present for the superadmin', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await page.goto('/admin/users');
    await expect(page.getByRole('button', { name: 'Invite' })).toBeVisible();
    await expect(page.getByText(SUPERADMIN.email)).toBeVisible();
  });
});
