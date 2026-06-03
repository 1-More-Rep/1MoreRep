import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.use({ storageState: STORAGE_STATE });

test.describe('P4 exercise library', () => {
  test('lists, searches, and opens an exercise detail', async ({ page }) => {
    await page.goto('/app/exercises');
    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

    await page.getByLabel('Search exercises').fill('Bench Press');
    const firstBench = page.getByRole('link', { name: /Bench Press/i }).first();
    await expect(firstBench).toBeVisible();
    await firstBench.click();

    await expect(page.getByRole('heading', { name: /Bench Press/i })).toBeVisible();
    await expect(page.getByText('Muscles worked')).toBeVisible();
    await expect(page.getByText('Chest', { exact: true })).toBeVisible();
  });

  test('filters by muscle', async ({ page }) => {
    await page.goto('/app/exercises');
    await page.getByLabel('Muscle').selectOption('BICEPS');
    await expect(page.getByText(/result/)).toBeVisible();
    await expect(page.getByRole('link').filter({ hasText: /./ }).first()).toBeVisible();
  });
});
