import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { STORAGE_STATE } from './paths';

// WCAG 2.2 AA — fail on serious/critical violations on key screens.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function audit(page: import('@playwright/test').Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // Fail the suite on serious/critical only; the assertion message carries the rule ids.
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test.describe('P12 accessibility (unauthenticated)', () => {
  test('login + design have no serious/critical violations', async ({ page }) => {
    for (const url of ['/login', '/design', '/offline']) {
      const v = await audit(page, url);
      expect(v, `${url}: ${v.map((x) => x.id).join(', ')}`).toEqual([]);
    }
  });
});

test.describe('P12 accessibility (authenticated)', () => {
  test.use({ storageState: STORAGE_STATE });
  test('core app screens have no serious/critical violations', async ({ page }) => {
    for (const url of ['/app', '/app/exercises', '/app/workout/new', '/app/muscle', '/app/progress', '/app/social', '/app/settings', '/app/settings/appearance']) {
      const v = await audit(page, url);
      expect(v, `${url}: ${v.map((x) => x.id).join(', ')}`).toEqual([]);
    }
  });
});
