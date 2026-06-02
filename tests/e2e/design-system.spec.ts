import { test, expect } from '@playwright/test';

test.describe('P1 design system', () => {
  test('renders all primitive groups', async ({ page }) => {
    await page.goto('/design');
    await expect(page.getByTestId('ds-title')).toHaveText('Design System');
    for (const group of ['Buttons', 'Chips & labels', 'Progress ring', 'Week activity', 'Cards', 'Icon tiles']) {
      await expect(page.getByText(group, { exact: true })).toBeVisible();
    }
  });

  test('dark mode toggles the document theme + persists', async ({ page }) => {
    await page.goto('/design');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('toggle-dark').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    // capture both themes as artifacts for visual review
    await page.screenshot({ path: 'test-results/design-dark.png', fullPage: true });
    // persists across reload (localStorage + boot script)
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('accent change updates the --accent custom property', async ({ page }) => {
    await page.goto('/design');
    await page.getByRole('button', { name: 'Azure' }).click();
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    );
    expect(accent).toBe('#2f6bff');
  });

  test('protected /app redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/);
  });
});
