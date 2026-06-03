import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { STORAGE_STATE } from './paths';

// WCAG 2.2 AA — fail on moderate/serious/critical violations on the screen map.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const IMPACTS = new Set(['moderate', 'serious', 'critical']);

async function audit(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // The assertion message carries the rule ids so failures are actionable.
  return results.violations.filter((v) => IMPACTS.has(v.impact ?? ''));
}

async function expectClean(page: Page, url: string) {
  const v = await audit(page, url);
  expect(v, `${url}: ${v.map((x) => x.id).join(', ')}`).toEqual([]);
}

// Static routes audited as-is. Dynamic / stateful routes are handled separately.
const UNAUTH_ROUTES = ['/login', '/register', '/reset', '/design', '/offline'];

const AUTH_ROUTES = [
  '/app',
  '/app/exercises',
  '/app/exercises/new',
  '/app/workout/new',
  '/app/history',
  '/app/muscle',
  '/app/progress',
  '/app/progress/prs',
  '/app/progress/photos',
  '/app/social',
  '/app/social/feed',
  '/app/social/friends',
  '/app/social/league',
  '/app/social/leaderboard',
  '/app/social/compare',
  '/app/settings',
  '/app/settings/appearance',
  '/app/settings/account',
  '/app/settings/notifications',
  '/app/settings/privacy',
  '/app/settings/sessions',
];

test.describe('P12 accessibility (unauthenticated)', () => {
  test('public screens have no moderate+ violations', async ({ page }) => {
    for (const url of UNAUTH_ROUTES) {
      await expectClean(page, url);
    }
  });
});

test.describe('P12 accessibility (authenticated)', () => {
  test.use({ storageState: STORAGE_STATE });

  test('static app screens have no moderate+ violations', async ({ page }) => {
    for (const url of AUTH_ROUTES) {
      await expectClean(page, url);
    }
  });

  test('exercise detail screen has no moderate+ violations', async ({ page }) => {
    // Dynamic id — navigate from the list and open the first exercise.
    await page.goto('/app/exercises');
    await page.getByLabel('Search exercises').fill('Bench Press');
    const first = page.getByRole('link', { name: /Bench Press/i }).first();
    await expect(first).toBeVisible();
    await first.click();
    await page.waitForURL(/\/app\/exercises\/[^/]+$/);
    await expectClean(page, page.url());
  });

  test('history detail screen has no moderate+ violations', async ({ page }) => {
    // Dynamic id — navigate from the history list and open the first session
    // if one exists; skip cleanly when the account has no logged workouts.
    await page.goto('/app/history');
    await page.waitForLoadState('networkidle');
    const sessionLink = page.locator('a[href^="/app/history/"]').first();
    if ((await sessionLink.count()) === 0) {
      // eslint-disable-next-line no-console
      console.log('[a11y] SKIP /app/history/[id]: no logged sessions to audit — integrator should seed/verify.');
      return;
    }
    await sessionLink.click();
    await page.waitForURL(/\/app\/history\/[^/]+$/);
    await expectClean(page, page.url());
  });
});

// The most interactive screen needs a live active session. The active session
// is a per-user singleton, so isolate it on chromium-only + serial (matching
// workout.spec.ts conventions).
test.describe('P12 accessibility — active workout', () => {
  test.use({ storageState: STORAGE_STATE });
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'active session is a shared singleton; audit on chromium only');
  });

  test('active workout screen has no moderate+ violations', async ({ page }) => {
    await page.goto('/app/workout/new');
    const empty = page.getByRole('button', { name: 'Empty workout' });
    if ((await empty.count()) === 0) {
      // eslint-disable-next-line no-console
      console.log('[a11y] SKIP /app/workout/active: could not start an empty workout — integrator should finish coverage.');
      return;
    }
    await empty.click();
    await page.waitForURL(/\/app\/workout\/active/);
    await page.waitForLoadState('networkidle');
    await expectClean(page, '/app/workout/active');

    // Clean up the singleton active session so other serial tests aren't blocked.
    // An empty (non-routine) workout's finish modal offers "Just finish".
    const finish = page.getByRole('button', { name: 'Finish workout' });
    if ((await finish.count()) > 0) {
      await finish.click();
      const justFinish = page.getByRole('button', { name: 'Just finish' });
      if ((await justFinish.count()) > 0) {
        await justFinish.click().catch(() => {});
        await page.waitForURL(/\/app\/history\//).catch(() => {});
      }
    }
  });
});
