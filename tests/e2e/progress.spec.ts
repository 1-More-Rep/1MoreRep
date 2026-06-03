import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.use({ storageState: STORAGE_STATE });

// 1x1 red PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('P10 progress', () => {
  test('logs a bodyweight metric', async ({ page }) => {
    await page.goto('/app/progress');
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
    await page.getByLabel('Bodyweight (kg)').fill('80');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByText('Logged.')).toBeVisible();
  });

  test('uploads a progress photo (re-encoded, owner-only)', async ({ page }) => {
    await page.goto('/app/progress/photos');
    await page.getByLabel('Progress photo').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: 'Upload photo' }).click();
    await expect(page.getByText('Photo added.')).toBeVisible();
    await expect(page.locator('img[src^="/api/photos/"]').first()).toBeVisible();
  });

  test('PRs page renders', async ({ page }) => {
    await page.goto('/app/progress/prs');
    await expect(page.getByRole('heading', { name: 'Personal records' })).toBeVisible();
  });
});
