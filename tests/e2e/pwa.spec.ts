import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.use({ storageState: STORAGE_STATE, timezoneId: 'UTC' });

test.describe('P11 PWA & push', () => {
  test('serves a valid web manifest', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.name).toBe('1MoreRep');
    expect(json.display).toBe('standalone');
    expect(json.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('serves the service worker', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBe(true);
    expect(await res.text()).toContain('addEventListener');
  });

  test('offline fallback page renders', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByRole('heading', { name: /offline/i })).toBeVisible();
  });

  test('notification settings render and save', async ({ page }) => {
    await page.goto('/app/settings/notifications');
    await expect(page.getByTestId('push-manager')).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Notification settings saved.')).toBeVisible();
  });

  test('onboarding completes into the generator', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
    await page.getByRole('button', { name: 'Generate my first workout' }).click();
    await page.waitForURL(/\/app\/workout\/generate/);
  });
});
