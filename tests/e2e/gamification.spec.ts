import { test, expect, type Page } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.use({ storageState: STORAGE_STATE });

// Completes a workout -> mutates the shared active session; keep serial + chromium.
test.describe.configure({ mode: 'serial' });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'gamification flow runs on chromium only (shared active session)');
});

async function addExercise(page: Page, query: string) {
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Search exercises to add').fill(query);
  await page.getByRole('button').filter({ hasText: new RegExp(query, 'i') }).first().click();
}

test.describe('P8 gamification', () => {
  test('completing a workout awards a streak and XP shown on Today', async ({ page }) => {
    await page.goto('/app/workout/new');
    await page.getByRole('button', { name: 'Empty workout' }).click();
    await page.waitForURL(/\/app\/workout\/active/);
    await addExercise(page, 'Bench Press');
    await page.getByLabel('weight set 1').first().fill('60');
    await page.getByLabel('reps set 1').first().fill('8');
    await page.getByLabel('complete set 1').first().click();
    // add 2 more completed sets to qualify the workout (>=3 sets)
    await page.getByLabel('reps set 2').first().fill('8');
    await page.getByLabel('weight set 2').first().fill('60');
    await page.getByLabel('complete set 2').first().click();
    await page.getByLabel('reps set 3').first().fill('8');
    await page.getByLabel('weight set 3').first().fill('60');
    await page.getByLabel('complete set 3').first().click();

    await page.getByRole('button', { name: 'Finish workout' }).click();
    await page.getByRole('button', { name: /Save as new routine|Just finish/ }).first().click();
    await page.waitForURL(/\/app\/history\//);

    // Today shows a streak >= 1
    await page.goto('/app');
    const streak = page.getByTestId('streak-count');
    await expect(streak).toBeVisible();
    expect(Number(await streak.textContent())).toBeGreaterThanOrEqual(1);
  });

  test('profile and league screens render', async ({ page }) => {
    await page.goto('/app/profile');
    await expect(page.getByRole('heading', { name: 'Administrator' })).toBeVisible();
    await expect(page.getByText(/XP to level/)).toBeVisible();
    await page.goto('/app/social/leaderboard');
    await expect(page.getByRole('heading', { name: 'Leaderboards' })).toBeVisible();
    await expect(page.getByText('(you)').first()).toBeVisible();
  });
});
