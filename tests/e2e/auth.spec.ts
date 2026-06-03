import { test, expect } from '@playwright/test';

test.describe('P2 auth', () => {
  test('login page renders password + magic-link modes', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await page.getByRole('button', { name: /magic link/i }).click();
    await expect(page.getByRole('button', { name: /Email me a sign-in link/i })).toBeVisible();
  });

  test('protected routes redirect to /login', async ({ page }) => {
    for (const path of ['/app', '/admin', '/account/password', '/onboarding']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('invalid magic-link callback shows an expired message (no consume on GET)', async ({ page }) => {
    await page.goto('/auth/callback?type=LOGIN_LINK&token=definitely-not-valid');
    await expect(page.getByText(/Link expired/i)).toBeVisible();
  });

  test('security headers are present', async ({ page }) => {
    const res = await page.goto('/login');
    const headers = res!.headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
  });
});
