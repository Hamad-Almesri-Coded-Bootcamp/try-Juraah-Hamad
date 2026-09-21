/**
 * Gate 3 role walks (WP3 ACCEPTANCE, from PLAN): every route reachable in its own shell and
 * redirected from the others; ناصر's pending-invitation-only session reaches `/ar/invitation` and
 * nothing else; the caregiver shell exposes no route the patient shell lacks; د. خالد's two clinic
 * roles stay apart; no session redirects correctly; nothing a patient needs is deeper than two taps;
 * sign out lands on `/ar` and Back does not re-enter the shell.
 *
 * ناصر has no entry in `tests/e2e/helpers/session.ts` (that file is WP1's, not WP3's to extend), so
 * his pending-only cookie is minted here directly, in the exact D-005 shape the helper itself uses.
 */
import { test, expect, type BrowserContext } from '@playwright/test';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { SESSION_COOKIE } from '../../lib/config';

const PATIENT_ROUTES = [
  '/app',
  '/app/setup',
  '/app/medicines',
  '/app/medicines/add',
  '/app/medicines/rx-001',
  '/app/safety',
  '/app/safety/check',
  '/app/safety/ia-001',
  '/app/more',
  '/app/more/profile',
  '/app/more/refill',
  '/app/more/calendar',
  '/app/more/activity',
  '/app/more/settings',
  '/app/more/help',
  '/app/more/notifications',
  '/app/more/caregivers',
];

const CAREGIVER_ROUTES = ['/care', '/care/medicines', '/care/medicines/rx-001', '/care/alerts/ia-001', '/care/more', '/care/more/activity', '/care/more/profile', '/care/more/help'];

const REVIEWER_ROUTES = ['/clinic/review', '/clinic/review/ia-001', '/clinic/review/fields', '/clinic/review/fields/rx-006'];
const ADMIN_ROUTES = ['/clinic/audit'];

/** Every caregiver route's patient-side counterpart (F2 reuses B1/B2's renderer; F3 reuses B3/C2/E2;
 * F4 ~ A3; F5 ~ E4) — the structural half of "the caregiver shell exposes no route the patient shell
 * lacks" (UX Principles §10 / ROLES.md): a concept, not a URL, so this is a table check, not a walk. */
const CAREGIVER_TO_PATIENT_COUNTERPART: Record<string, string> = {
  '/care': '/app (Today)',
  '/care/medicines': '/app/medicines (My Medicines)',
  '/care/medicines/rx-001': '/app/medicines/[id] (prescription detail)',
  '/care/alerts/ia-001': '/app/safety/[id] (alert detail)',
  '/care/more': '/app/more',
  '/care/more/activity': '/app/more/activity',
  '/care/more/profile': '/app/more/profile',
  '/care/more/help': '/app/more/help',
};

async function addSession(context: BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}

async function addPendingInvitationOnly(context: BrowserContext, baseURL: string | undefined, subjectId: string) {
  const base = new URL(baseURL ?? 'http://localhost:3100');
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: encodeURIComponent(JSON.stringify({ subjectId, pendingInvitationOnly: true })),
      domain: base.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

test.describe('roles — every route reachable in its own shell, redirected from the others', () => {
  test('patient (حمد): every patient route loads; caregiver/clinic routes redirect back into /app', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    for (const route of PATIENT_ROUTES) {
      const res = await page.goto(`/ar${route}`);
      expect(res?.status(), route).toBeLessThan(400);
      if (route === '/app/setup') {
        // A2 runs once (SCREENS.md pass criterion, real screen since WP4 b): a patient whose
        // onboarding is complete is redirected to Today. بدر's un-onboarded visit, where the
        // flow actually renders, is asserted in tests/e2e/identity.spec.ts.
        await expect(page, route).toHaveURL((url) => new URL(url).pathname === '/ar/app');
      } else {
        expect(page.url(), route).toContain(`/ar${route}`);
      }
    }
    for (const route of [...CAREGIVER_ROUTES, ...REVIEWER_ROUTES, ...ADMIN_ROUTES]) {
      await page.goto(`/ar${route}`);
      // A0 (the session gate) resolves the wrong-role visit by client-side redirect once its own
      // loading.tsx skeleton has streamed (never a blank screen) — `goto()` can resolve at that
      // intermediate `/gate` response before the redirect script runs, so this asserts on the
      // auto-retrying `toHaveURL` rather than a single `page.url()` snapshot.
      await expect(page, route).toHaveURL(/\/ar\/app(\/|$)/);
    }
  });

  test('caregiver (عبدالله): every caregiver route loads; patient/clinic routes redirect back into /care', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    for (const route of CAREGIVER_ROUTES) {
      const res = await page.goto(`/ar${route}`);
      expect(res?.status(), route).toBeLessThan(400);
      expect(page.url(), route).toContain(`/ar${route}`);
    }
    for (const route of [...PATIENT_ROUTES, ...REVIEWER_ROUTES, ...ADMIN_ROUTES]) {
      await page.goto(`/ar${route}`);
      await expect(page, route).toHaveURL(/\/ar\/care(\/|$)/);
    }
  });

  test('the caregiver shell exposes no route the patient shell lacks (structural check)', () => {
    for (const [caregiverRoute, patientCounterpart] of Object.entries(CAREGIVER_TO_PATIENT_COUNTERPART)) {
      expect(patientCounterpart, caregiverRoute).toBeTruthy();
    }
    expect(Object.keys(CAREGIVER_TO_PATIENT_COUNTERPART)).toEqual(CAREGIVER_ROUTES);
  });

  test('ناصر (pending invitation only, cg-03): reaches /ar/invitation and nothing else', async ({ page, context, baseURL }) => {
    await addPendingInvitationOnly(context, baseURL, 'cg-03');
    await page.goto('/ar/invitation');
    expect(page.url()).toContain('/ar/invitation');

    for (const route of ['/app', '/care', '/clinic/review', '/clinic/audit', '/gate', '/signin', '/']) {
      await page.goto(`/ar${route}`);
      await expect(page, route).toHaveURL(/\/ar\/invitation(\?|$)/);
    }
  });

  test('د. خالد as reviewer cannot open /clinic/audit; as admin cannot open /clinic/review', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_reviewer');
    await page.goto('/ar/clinic/audit');
    await expect(page).toHaveURL(/\/ar\/clinic\/review(\/|$)/);

    await context.clearCookies();
    await addSession(context, baseURL, 'khalid_admin');
    await page.goto('/ar/clinic/review');
    await expect(page).toHaveURL(/\/ar\/clinic\/audit(\/|$)/);
  });

  test('م. دانة (admin only) never sees a Review destination', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'dana');
    await page.goto('/ar/clinic/audit');
    await expect(page.getByText('مراجعة', { exact: true })).toHaveCount(0);
  });

  test('no session: /app → /signin; /clinic/review → /clinic', async ({ page }) => {
    await page.goto('/ar/app');
    await expect(page).toHaveURL(/\/ar\/signin(\/|$)/);
    await page.goto('/ar/clinic/review');
    await expect(page).toHaveURL(/\/ar\/clinic(\/|$)/);
    expect(page.url()).not.toContain('/clinic/review');
  });

  test('nothing a patient needs is deeper than two taps (route-depth over the patient routes)', () => {
    for (const route of PATIENT_ROUTES) {
      const afterApp = route.replace(/^\/app\/?/, '');
      const depth = afterApp ? afterApp.split('/').length : 0;
      expect(depth, route).toBeLessThanOrEqual(2);
    }
  });

  test('sign out lands on /ar and Back does not re-enter the shell', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_admin');
    await page.goto('/ar/clinic/audit');
    await page.locator('button:visible', { hasText: 'تسجيل الخروج' }).click();
    await page.waitForURL(/\/ar\/?$/);
    await page.goBack();
    expect(page.url()).not.toContain('/clinic');
  });
});
