import { test, expect } from '@playwright/test';
import { STORAGE_STATE, SUPERADMIN } from './paths';

test.use({ storageState: STORAGE_STATE });

test.describe('P3 admin', () => {
  test('superadmin reaches the admin dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Users', { exact: true }).first()).toBeVisible();
  });

  test('superadmin toggles self-registration and it persists', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.getByRole('checkbox', { name: /register themselves/i }).check();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: /register themselves/i })).toBeChecked();
  });

  test('invite form is present for the superadmin', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('button', { name: 'Invite' })).toBeVisible();
    await expect(page.getByText(SUPERADMIN.email)).toBeVisible();
  });
});
