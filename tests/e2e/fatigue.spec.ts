import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.use({ storageState: STORAGE_STATE });

test.describe('P6 muscle map', () => {
  test('renders the body map and shows detail on muscle select', async ({ page }) => {
    await page.goto('/app/muscle');
    await expect(page.getByRole('heading', { name: 'Recovery' })).toBeVisible();
    await expect(page.locator('svg[aria-label*="view"]')).toBeVisible();

    // tap a muscle region (front view shows Chest)
    await page.getByRole('button', { name: /Chest, \d+% fatigued/ }).first().click();
    await expect(page.getByTestId('muscle-detail')).toBeVisible();
    await expect(page.getByTestId('muscle-detail').getByText('Chest', { exact: true })).toBeVisible();
  });

  test('can switch to the back view', async ({ page }) => {
    await page.goto('/app/muscle');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('button', { name: /Lats, \d+% fatigued/ }).first()).toBeVisible();
  });
});
