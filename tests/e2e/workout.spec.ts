import { test, expect, type Page } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.use({ storageState: STORAGE_STATE });

// The active session is a per-user singleton; serialize + single project so the
// two flows don't fight over it (the same shared superadmin account).
test.describe.configure({ mode: 'serial' });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'workout flow runs on chromium only (shared active session)');
});

async function addExercise(page: Page, query: string) {
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Search exercises to add').fill(query);
  await page.getByRole('button').filter({ hasText: new RegExp(query, 'i') }).first().click();
}

test.describe('P5 workout logging', () => {
  test('log an empty workout, edit a set, finish and save as a new routine', async ({ page }) => {
    await page.goto('/app/workout/new');
    await page.getByRole('button', { name: 'Empty workout' }).click();
    await page.waitForURL(/\/app\/workout\/active/);

    await addExercise(page, 'Bench Press');
    await page.getByLabel('weight set 1').first().fill('60');
    await page.getByLabel('reps set 1').first().fill('8');
    await page.getByLabel('complete set 1').first().click();
    await expect(page.getByLabel('complete set 1').first()).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Finish workout' }).click();
    await page.getByLabel('Routine name').fill('E2E Bench Routine');
    await page.getByRole('button', { name: 'Save as new routine' }).click();

    await page.waitForURL(/\/app\/history\//);
    await expect(page.getByText('60 kg')).toBeVisible();
  });

  test('starting a routine and modifying it makes the finish modal detect changes', async ({ page }) => {
    // create a routine
    await page.goto('/app/workouts');
    await page.getByLabel('New routine').fill('E2E Mod Routine');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/app\/workouts\//);
    await addExercise(page, 'Squat');
    await expect(page.getByText(/Squat/i).first()).toBeVisible();

    // start it, then add an exercise (makes it dirty)
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page.waitForURL(/\/app\/workout\/active/);
    await addExercise(page, 'Curl');

    await page.getByRole('button', { name: 'Finish workout' }).click();
    await expect(page.getByText(/You changed this workout/i)).toBeVisible();
    await page.getByRole('button', { name: "Don't save changes" }).click();
    await page.waitForURL(/\/app\/history\//);
  });
});
