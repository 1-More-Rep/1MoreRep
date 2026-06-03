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

  test('creates a custom exercise and finds it again', async ({ page }) => {
    // Unique name so re-runs don't collide on the same library entry.
    const name = `E2E Custom Lift ${Date.now()}`;

    await page.goto('/app/exercises/new');
    await expect(page.getByRole('heading', { name: 'New exercise' })).toBeVisible();

    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Equipment').selectOption('DUMBBELL');
    await page.getByLabel('Primary muscle').selectOption('BICEPS');
    await page.getByRole('button', { name: 'Create exercise' }).click();

    // The create action redirects to the new exercise's detail page.
    await page.waitForURL(/\/app\/exercises\/[^/]+$/);
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

    // And it is searchable back in the library.
    await page.goto('/app/exercises');
    await page.getByLabel('Search exercises').fill(name);
    await expect(page.getByRole('link', { name: new RegExp(name, 'i') }).first()).toBeVisible();
  });
});
