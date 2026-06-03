import { test, expect, type Page } from '@playwright/test';

const SUPERADMIN = { email: 'admin@1morerep.local', password: 'devsuperpass123' };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(SUPERADMIN.email);
  await page.getByLabel('Password').fill(SUPERADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/app/);
}

test.describe('P4 exercise library', () => {
  test('lists, searches, and opens an exercise detail', async ({ page }) => {
    await login(page);
    await page.goto('/app/exercises');
    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

    await page.getByLabel('Search exercises').fill('Bench Press');
    // wait for the filtered list to settle and open the first matching exercise
    const firstBench = page.getByRole('link', { name: /Bench Press/i }).first();
    await expect(firstBench).toBeVisible();
    await firstBench.click();

    await expect(page.getByRole('heading', { name: /Bench Press/i })).toBeVisible();
    await expect(page.getByText('Muscles worked')).toBeVisible();
    await expect(page.getByText('Chest', { exact: true })).toBeVisible();
  });

  test('filters by muscle', async ({ page }) => {
    await login(page);
    await page.goto('/app/exercises');
    await page.getByLabel('Muscle').selectOption('BICEPS');
    await expect(page.getByText(/result/)).toBeVisible();
    // at least one result row is present
    await expect(page.getByRole('link').filter({ hasText: /./ }).first()).toBeVisible();
  });
});
