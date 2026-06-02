import { test, expect } from '@playwright/test';

test.describe('P0 smoke', () => {
  test('root redirects unauthenticated users to login (branded)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('health endpoint responds', async ({ request }) => {
    const res = await request.get('/api/health');
    // 200 when DB is reachable, 503 when not — both prove the route is wired.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });
});
