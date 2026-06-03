import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.use({ storageState: STORAGE_STATE });

// Mutates the shared active session — keep on one project + serial.
test.describe.configure({ mode: 'serial' });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'generator flow runs on chromium only (shared active session)');
});

test.describe('P7 workout generator', () => {
  test('generates a plan with an explanation and starts it', async ({ page }) => {
    await page.goto('/app/workout/generate');
    await expect(page.getByRole('heading', { name: 'Generate a workout' })).toBeVisible();

    await page.getByRole('button', { name: 'Strength' }).click();
    await page.getByRole('button', { name: '60 min' }).click();
    await page.getByRole('button', { name: 'Generate workout' }).click();

    // deterministic explanation (no LLM configured) + a non-empty plan
    await expect(page.getByTestId('gen-explanation')).toBeVisible();
    await expect(page.getByTestId('gen-explanation')).toContainText(/exercise session/);

    await page.getByRole('button', { name: 'Start this workout' }).click();
    await page.waitForURL(/\/app\/workout\/active/);
    // the active session has the generated exercises (at least one set row)
    await expect(page.getByLabel('complete set 1').first()).toBeVisible();
  });
});
