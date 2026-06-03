import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.use({ storageState: STORAGE_STATE });

test.describe('P9 social', () => {
  test('friends page: add a friend by handle', async ({ page }) => {
    await page.goto('/app/social/friends');
    await expect(page.getByRole('heading', { name: 'Friends' })).toBeVisible();
    // Live typeahead: type a handle (>=2 chars), then click "Add" on the result.
    await page.getByLabel('Search by @handle').fill('frienduser');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(/Friend request sent|already pending|Already friends/i)).toBeVisible();
  });

  test('public profile renders for a handle', async ({ page }) => {
    await page.goto('/app/u/frienduser');
    await expect(page.getByRole('heading', { name: 'Friend User' })).toBeVisible();
    await expect(page.getByText('@frienduser')).toBeVisible();
  });

  test('privacy settings can be saved', async ({ page }) => {
    await page.goto('/app/settings/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
    await page.getByRole('button', { name: 'Save privacy' }).click();
    await expect(page.getByText('Privacy settings saved.')).toBeVisible();
  });

  test('friend activity feed renders', async ({ page }) => {
    await page.goto('/app/social/feed');
    await expect(page.getByRole('heading', { name: 'Friend activity' })).toBeVisible();
  });
});
