import { test, expect, type Page } from '@playwright/test';
import { STORAGE_STATE } from './paths';

// The canonical end-to-end journey, chained in one flow. Mutates the shared
// active session -> single project + serial.
test.use({ storageState: STORAGE_STATE });
test.describe.configure({ mode: 'serial' });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'golden journey runs on chromium only');
});

async function addExercise(page: Page, query: string) {
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Search exercises to add').fill(query);
  await page.getByRole('button').filter({ hasText: new RegExp(query, 'i') }).first().click();
}

test('golden journey: generate -> log -> finish -> gamify -> recover -> compete', async ({ page }) => {
  // 1. Generate a workout
  await page.goto('/app/workout/generate');
  await page.getByRole('button', { name: 'Generate workout' }).click();
  await expect(page.getByTestId('gen-explanation')).toBeVisible();
  await page.getByRole('button', { name: 'Start this workout' }).click();
  await page.waitForURL(/\/app\/workout\/active/);

  // 2. Add a known exercise + log 3 qualifying sets
  await addExercise(page, 'Bench Press');
  for (const i of [1, 2, 3]) {
    await page.getByLabel(`weight set ${i}`).first().fill('60');
    await page.getByLabel(`reps set ${i}`).first().fill('8');
    await page.getByLabel(`complete set ${i}`).first().click();
  }

  // 3. Finish (ad-hoc -> just finish)
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('button', { name: /Just finish|Save as new routine/ }).first().click();
  await page.waitForURL(/\/app\/history\//);

  // 4. Gamification surfaced on Today
  await page.goto('/app');
  await expect(page.getByTestId('streak-count')).toBeVisible();
  expect(Number(await page.getByTestId('streak-count').textContent())).toBeGreaterThanOrEqual(1);

  // 5. Recovery: the 2D muscle map renders with chest worked
  await page.goto('/app/muscle');
  await expect(page.locator('svg[aria-label*="view"]')).toBeVisible();

  // 6. Compete: leaderboard shows the user
  await page.goto('/app/social/leaderboard');
  await expect(page.getByText('(you)').first()).toBeVisible();
});
