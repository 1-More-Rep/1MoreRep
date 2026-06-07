import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './paths';

test.use({ storageState: STORAGE_STATE });

test.describe('P6 muscle map', () => {
  test('renders the body map and shows detail on muscle select', async ({ page }) => {
    await page.goto('/app/muscle');
    await expect(page.getByRole('heading', { name: 'Recovery' })).toBeVisible();
    await expect(page.locator('svg[aria-label*="view"]')).toBeVisible();

    // Tap a muscle region (front view shows Chest). Each region is hit-tested on
    // its painted shape (not the bounding box), so click the visible pec, not the
    // group's geometric center — which falls in the gap between the two pecs.
    await page.getByRole('button', { name: /Chest, \d+% fatigued/ }).first().locator('rect').first().click();
    await expect(page.getByTestId('muscle-detail')).toBeVisible();
    await expect(page.getByTestId('muscle-detail').getByText('Chest', { exact: true })).toBeVisible();
  });

  test('can switch to the back view', async ({ page }) => {
    await page.goto('/app/muscle');
    await page.getByRole('tab', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('button', { name: /Lats, \d+% fatigued/ }).first()).toBeVisible();
  });

  test('opens the muscle detail via keyboard (Enter / Space)', async ({ page }) => {
    await page.goto('/app/muscle');
    await expect(page.locator('svg[aria-label*="view"]')).toBeVisible();

    // Focus a region (role="button", tabIndex=0) and activate it with the
    // keyboard — the same outcome the click path asserts.
    const chest = page.getByRole('button', { name: /Chest, \d+% fatigued/ }).first();
    await chest.focus();
    await expect(chest).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('muscle-detail')).toBeVisible();
    await expect(page.getByTestId('muscle-detail').getByText('Chest', { exact: true })).toBeVisible();

    // Space should activate a region too (select a different muscle).
    const abs = page.getByRole('button', { name: /Abs, \d+% fatigued/ }).first();
    await abs.focus();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('muscle-detail').getByText('Abs', { exact: true })).toBeVisible();
  });

  test('region fill tints with fatigue', async ({ page }) => {
    await page.goto('/app/muscle');
    const biceps = page.getByRole('button', { name: /Biceps, \d+% fatigued/ }).first();
    await expect(biceps).toBeVisible();

    // Resolve the default "fresh" fill (var(--surface-2)) so the comparison is
    // robust to the browser's computed color format.
    const defaultFill = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = 'var(--surface-2)';
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });

    const fillOf = (el: import('@playwright/test').Locator) =>
      el.evaluate((node) => getComputedStyle(node as Element).fill);

    // Drive fatigue on this muscle: select it and report high soreness, which
    // recomputes fatigue and tints the region away from the default surface.
    // Click the painted arm shape (the group center sits over the torso).
    await biceps.locator('rect').first().click();
    await page.getByTestId('muscle-detail').getByRole('button', { name: '10', exact: true }).click();

    // The page revalidates after logging soreness; wait for the tint to apply.
    await expect
      .poll(async () => fillOf(biceps), { timeout: 10_000, message: 'biceps fill should tint after soreness' })
      .not.toBe(defaultFill);
  });
});
