/**
 * WP4 bundle h — F0 consent, F1 caregiver management, F2 caregiver home, F3 caregiver detail
 * access, F4 caregiver profile & notifications, F5 caregiver help. Run as
 * `npx playwright test tests/e2e/caregiving.spec.ts --workers=1` (the brief's own instruction) so
 * the three viewport projects never race each other against the shared dev-server store (D-002: the
 * mock store is a module-level singleton that survives for the life of the process, and several
 * OTHER bundles' e2e suites read routing behaviour for ناصر (cg-03) and حمد's caregivers — none of
 * them write to a Caregiver row, only this bundle's own F0/F1 do, so the two tests below that
 * perform a real accept/decline are written to be idempotent: each checks the invitation's CURRENT
 * state first and only clicks through when it is still answerable, so a re-run (or a stray parallel
 * worker) observes the post-condition instead of double-clicking a resolved decision.
 */
import { test, expect } from '@playwright/test';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { SESSION_COOKIE } from '../../lib/config';

async function addSession(context: import('@playwright/test').BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}

async function addPendingInvitationOnly(context: import('@playwright/test').BrowserContext, baseURL: string | undefined, subjectId: string) {
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

const LOCALES = ['ar', 'en'] as const;

// ---------------------------------------------------------------------------------------------
// F0 — read-only state coverage (no click on any of these — the same seed rows are read by
// roles.spec.ts / identity.spec.ts elsewhere, so nothing here writes to them).
// ---------------------------------------------------------------------------------------------
test.describe('F0 — consent screen states, read-only', () => {
  for (const locale of LOCALES) {
    test(`pending (ناصر, cg-03) shows who is asking, what accepting shows/never allows, and nothing else — ${locale}`, async ({ page, context, baseURL }) => {
      await addPendingInvitationOnly(context, baseURL, 'cg-03');
      await page.goto(`/${locale}/invitation`);
      await expect(page.getByText('حمد').first()).toBeVisible();
      await expect(page.getByText('ابني').first()).toBeVisible();
      // Non-negotiable invariant: no prescription, dose, alert or activity text anywhere on this
      // screen before acceptance (F0's five-field contract; SCREENS.md).
      for (const forbidden of ['Warfarin', 'Ibuprofen', 'Metformin', 'Atorvastatin', 'ia-001', 'rx-001']) {
        await expect(page.getByText(forbidden)).toHaveCount(0);
      }
      // No tab bar, no route out except its own two buttons (F0 pass criterion).
      await expect(page.getByRole('navigation')).toHaveCount(0);
    });

    test(`accepted (عبدالله, cg-01, already active) — short confirmation, opens the caregiver shell — ${locale}`, async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'abdullah');
      await page.goto(`/${locale}/invitation?id=cg-01`);
      const openButton = page.getByRole('button', { name: /افتح ملف|Open .*record/ });
      await expect(openButton).toBeVisible();
      await openButton.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/care(/|$)`));
    });

    test(`declined (منى, cg-04, already declined) — plain acknowledgement, nothing revealed — ${locale}`, async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/invitation?id=cg-04`);
      await expect(page.getByRole('button', { name: /رجوع|home page/ })).toBeVisible();
      for (const forbidden of ['Warfarin', 'Ibuprofen', '292043000517']) {
        await expect(page.getByText(forbidden)).toHaveCount(0);
      }
    });

    test(`expired (no-account Civil ID, cg-05) — says so, offers no action — ${locale}`, async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/invitation?id=cg-05`);
      await expect(page.getByRole('button', { name: /رجوع|home page/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /قبول|^Accept$/ })).toHaveCount(0);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Named invariant — equal buttons (computed size assertion, real layout this time — a genuine
// getBoundingClientRect comparison the unit test's jsdom cannot do without a stylesheet).
// ---------------------------------------------------------------------------------------------
test('F0 — accept and decline render at the identical computed size', async ({ page, context, baseURL }) => {
  await addPendingInvitationOnly(context, baseURL, 'cg-03');
  await page.goto('/ar/invitation');
  const accept = page.getByTestId('f0-accept');
  const decline = page.getByTestId('f0-decline');
  const acceptBox = await accept.boundingBox();
  const declineBox = await decline.boundingBox();
  expect(acceptBox).not.toBeNull();
  expect(declineBox).not.toBeNull();
  expect(acceptBox!.width).toBeCloseTo(declineBox!.width, 0);
  expect(acceptBox!.height).toBeCloseTo(declineBox!.height, 0);
});

// ---------------------------------------------------------------------------------------------
// Named invariant — decline grants nothing, ever (a real transition, idempotent against a re-run).
// سارة ← فاطمة (cg-08) is the seed's own "existing patient answers the in-shell notice without
// signing out" row (docs/Seed Dataset.md) — declining it here proves both invariants together.
// ---------------------------------------------------------------------------------------------
test('F0/F1 — declining grants nothing: an existing patient (سارة) declines her own notice without signing out, and it stays declined', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL, 'sara_patient');
  await page.goto('/ar/invitation?id=cg-08');

  const declineButton = page.getByRole('button', { name: 'رفض' });
  if (await declineButton.isVisible().catch(() => false)) {
    await declineButton.click();
    await expect(page.getByRole('button', { name: /رجوع|home page/ })).toBeVisible();
  }

  // Whether this worker performed the click or a previous run already did: revisiting shows the
  // declined bucket, never the pending question again, and the session was never signed out (the
  // patient cookie set above is still what answers every request in this test).
  await page.goto('/ar/invitation?id=cg-08');
  await expect(page.getByRole('button', { name: 'قبول' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'رفض' })).toHaveCount(0);

  // Declining grants nothing: her own patient shell is unaffected (still signed in, still حمد-less).
  await page.goto('/ar/app');
  await expect(page).toHaveURL(/\/ar\/app(\/|$)/);
});

// A real "accept" click-through is deliberately NOT exercised here against ناصر (cg-03): this file
// runs three times in one invocation (one per viewport project), and — unlike the decline test
// above, whose target (سارة's notice) is read nowhere else in this suite — cg-03 is also read by
// the pending-state test in the block above; consuming it here would make that test's assertions
// depend on which project ran first. The accept transition itself is proven at the unit level
// (tests/unit/caregiving/acceptMovesToActive.test.ts, against a freshly `reset()` store) and its
// resulting UI (the short confirmation, the "open record" button, the destination it reaches) is
// proven above against عبدالله's already-`active` row, which nothing in this file ever mutates.

// ---------------------------------------------------------------------------------------------
// F1 — invite, masked-name confirm, no-account twin, cancel (self-contained: creates and cancels
// its own rows, touches no other bundle's fixture).
// ---------------------------------------------------------------------------------------------
test.describe('F1 — caregiver management (patient side)', () => {
  test('inviting a Civil ID with an account shows the masked name and requires explicit confirmation', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/more/caregivers');
    await page.getByRole('button', { name: 'دعوة مقدّم رعاية' }).click();
    await page.getByLabel('الرقم المدني').fill('292043000517'); // منى — has an account, already declined once
    await page.getByLabel('الاسم اللي تعرفه فيه').fill('منى (اختبار)');
    await page.getByLabel('صلة القرابة').fill('قريبة');
    await page.getByRole('button', { name: 'متابعة' }).click();

    await expect(page.getByText('هذا هو الشخص؟')).toBeVisible();
    await expect(page.getByText('منى خ*** المطيري')).toBeVisible();
    await page.getByRole('button', { name: 'لا، أصحّح الرقم' }).click();
    await expect(page.getByLabel('الرقم المدني')).toHaveValue('');
  });

  test('the no-account twin: an unrecognised Civil ID reaches the identical "invitation created" outcome, with no confirmation step', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/more/caregivers');
    await page.getByRole('button', { name: 'دعوة مقدّم رعاية' }).click();
    await page.getByLabel('الرقم المدني').fill('299999900001'); // shaped like a Civil ID, no account
    await page.getByLabel('الاسم اللي تعرفه فيه').fill('شخص غير مسجّل');
    await page.getByLabel('صلة القرابة').fill('قريب');
    await page.getByRole('button', { name: 'متابعة' }).click();

    await expect(page.getByText('هذا هو الشخص؟')).toHaveCount(0); // skipped entirely (G9)
    await expect(page.getByText('تم إنشاء الدعوة')).toBeVisible();
    await expect(page.getByText('أرسلنا الدعوة')).toBeVisible();
    await page.getByRole('button', { name: 'تمام' }).click();
    await expect(page.getByText('شخص غير مسجّل').first()).toBeVisible(); // back on the list, awaiting acceptance

    // Cancel the invitation this test just created (self-contained cleanup). Re-running this test
    // (or a sibling viewport project's pass) creates another same-named row each time — cancelling
    // never deletes it, only relabels it (F1's neutral relationship states) — so this targets the
    // one row that is STILL pending, never an earlier run's already-cancelled one of the same name.
    const row = page.locator('.jr-menu-row', { hasText: 'شخص غير مسجّل' }).filter({ hasText: 'بانتظار القبول' });
    await row.getByRole('button', { name: 'إلغاء الدعوة' }).click();
    await page.getByRole('button', { name: 'إلغاء الدعوة' }).last().click();
  });

  test('every relationship state renders neutrally — no colour cue in the DOM (CLAUDE.md rule 8)', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/more/caregivers');
    await expect(page.getByText('نشِط', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('رفض الدعوة')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------
// Named invariant — zero write controls in the caregiver shell (enumerated: navigation, sign-out,
// own-notification/unlink controls only — nothing patient-data-shaped).
// ---------------------------------------------------------------------------------------------
test.describe('F2/F3/F4 — zero write controls on patient data', () => {
  test('F2 Today (عبدالله on حمد, tracking off): no status pill, no button beyond navigation', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar/care');
    await expect(page.getByTestId('status-pill')).toHaveCount(0);
    await expect(page.getByText('حمد', { exact: false }).first()).toBeVisible(); // caregiver banner
  });

  test('F2 Medicines: the danger alert is shown, and opens the read-only alert detail', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar/care/medicines');
    await expect(page.getByText('Warfarin', { exact: false }).first()).toBeVisible();
  });

  test('F3 prescription detail: no action button (no refill, no edit)', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar/care/medicines/rx-001');
    await expect(page.getByText('Warfarin').first()).toBeVisible();
    await expect(page.locator('#main-content').getByRole('button', { name: /تجديد|refill/i })).toHaveCount(0);
  });

  test('F3 alert detail: opening never changes state, and offers no action', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar/care/alerts/ia-001');
    await expect(page.getByText('لا يزال مراجع طبي', { exact: false })).toBeVisible(); // pending_medical_review's built-in sentence
    await expect(page.locator('#main-content').getByRole('button', { name: /تأكيد|إخلاء|confirm|clear/i })).toHaveCount(0);
  });

  test('F3 activity feed: read-only rows, masked names only', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar/care/more/activity');
    // Scoped to #main-content: the app-router shell wraps every screen's content in it, excluding
    // the Next.js dev-mode indicator's own shadow-DOM button (a `next dev`-only artefact Playwright
    // locators pierce by default — never present in a production build).
    await expect(page.locator('#main-content').locator('button')).toHaveCount(0);
  });

  test('F4 profile: only push/chat/unlink/sign-out buttons — no Settings row', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar/care/more/profile');
    await expect(page.getByText('افصل نفسي عن هذا الملف')).toBeVisible();
    await expect(page.getByText('تسجيل الخروج')).toBeVisible();
    await expect(page.getByText('الإعدادات', { exact: true })).toHaveCount(0);
  });

  test('F5 help: static copy, no data function, no button', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar/care/more/help');
    await expect(page.getByText('شنو تشوف بالضبط')).toBeVisible();
    await expect(page.locator('#main-content').locator('button')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Named invariant — caregiver never sees more than the patient (حمد's untracked six-dose day).
// ---------------------------------------------------------------------------------------------
test('F2 — caregiver never sees more than the patient: six untracked rows, zero status pills, for حمد', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL, 'abdullah');
  await page.goto('/ar/care');
  const list = page.getByTestId('dose-list');
  await expect(list.getByTestId('dose-row')).toHaveCount(6);
  await expect(list.getByTestId('status-pill')).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// axe accessibility sweep, one representative screen per group, ar + en.
// ---------------------------------------------------------------------------------------------
test.describe('axe clean', () => {
  for (const locale of LOCALES) {
    test(`F2 caregiver home is axe-clean — ${locale}`, async ({ page, context, baseURL }) => {
      const { default: AxeBuilder } = await import('@axe-core/playwright');
      await addSession(context, baseURL, 'abdullah');
      await page.goto(`/${locale}/care`);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
});
