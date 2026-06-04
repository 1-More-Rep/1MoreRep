import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.describe('feedback', () => {
  test.use({ storageState: STORAGE_STATE });

  test('profile surfaces a feedback link and the admin menu (admin user)', async ({ page }) => {
    await page.goto('/app/profile');
    await expect(page.getByRole('link', { name: /Send feedback/i })).toBeVisible();
    // The seeded account is a superadmin → the admin-only menu is shown.
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Feedback/ })).toBeVisible();
  });

  test('user submits feedback and an admin triages it', async ({ page }) => {
    const message = `E2E feedback ${Date.now()}`;
    await page.goto('/app/feedback');
    await page.getByRole('radio', { name: 'Bug' }).click(); // category picker = radiogroup
    await page.getByPlaceholder(/Tell us/i).fill(message);
    await page.getByRole('button', { name: /Submit feedback/i }).click();
    await expect(page.getByText(/your feedback was submitted/i)).toBeVisible();
    await expect(page.getByText(message)).toBeVisible(); // appears under "Your submissions"

    // Admin review: it shows up and its status can be changed (persisted).
    await page.goto('/admin/feedback');
    await expect(page.getByText(message)).toBeVisible();
    const card = page.locator('div').filter({ hasText: message }).filter({ has: page.getByRole('combobox') }).last();
    const statusSelect = card.getByRole('combobox');
    await statusSelect.selectOption('IN_PROGRESS');
    await expect(statusSelect).toHaveValue('IN_PROGRESS');
  });
});
