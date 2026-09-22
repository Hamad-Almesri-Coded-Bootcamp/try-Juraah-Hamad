/**
 * WP4 bundle i — X0 (clinic entry + role chooser), G1s (reviewer queue, findings), G2s (reviewer
 * decision), G3s (reviewer queue, field confirmation), X1 (system audit log — the demo's proof
 * moment). Run as `npx playwright test tests/e2e/clinic.spec.ts --workers=1` (this file runs once
 * per viewport project — phone-390/tablet-834/desktop-1440 — so `--workers=1` serialises them
 * against the one shared dev-server store, same reasoning as `tests/e2e/caregiving.spec.ts`).
 *
 * G2s's and G3s's own mutating tests are each written to be idempotent, like caregiving.spec.ts's
 * accept/decline tests: ia-001 and rx-006 are each the seed's ONLY item in their respective queue,
 * so once reviewed/confirmed-or-returned they never return to `pending` for the life of the dev
 * server. Each test checks the current state first and only clicks through when the item is still
 * actionable, then asserts the resulting invariant either way — so a re-run (or a second viewport
 * project) observes the post-condition instead of double-committing a decision.
 */
import { test, expect, type BrowserContext } from '@playwright/test';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';

const LOCALES = ['ar', 'en'] as const;

async function addSession(context: BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}

// ---------------------------------------------------------------------------------------------
// X0 — clinic entry & role chooser
// ---------------------------------------------------------------------------------------------
test.describe('X0 — clinic entry', () => {
  test('an invalid Civil ID is refused with a specific error, input kept', async ({ page }) => {
    await page.goto('/ar/clinic');
    await page.getByLabel('الرقم المدني').fill('000000000000');
    await page.getByRole('button', { name: 'متابعة' }).click();
    await expect(page.getByText('غير موجود في القائمة التجريبية')).toBeVisible();
    await expect(page.getByLabel('الرقم المدني')).toHaveValue('000000000000');
  });

  test('X0’s refusal wording for an accountless ID equals A1’s no_claims wording, byte for byte', async ({ page }) => {
    await page.goto('/ar/clinic');
    await page.getByLabel('الرقم المدني').fill('277091900873'); // no account at all — writes no session cookie
    await page.getByRole('button', { name: 'متابعة' }).click();
    await expect(page.getByTestId('clinic-refused')).toBeVisible({ timeout: 10_000 });
    const accountlessText = await page.getByTestId('clinic-refused').innerText();

    // A1's own no_claims copy — byte-identical (rule 6), never a hint that either ID exists.
    await page.goto('/ar/signin');
    await page.getByLabel('الرقم المدني').fill('277091900873');
    await page.getByRole('button', { name: 'متابعة' }).click();
    await expect(page.getByTestId('no-claims')).toBeVisible({ timeout: 10_000 });
    const a1Text = await page.getByTestId('no-claims').innerText();
    expect(a1Text).toContain(accountlessText.split('\n')[0]); // the title line, at minimum, matches
  });

  // Known gap (CR-039, docs/DECISIONS.md): a patient-only ID is SPECIFIED to see this same refusal
  // (SCREENS.md/ACCEPTANCE), but `signIn` writing حمد's session cookie triggers proxy.ts's and the
  // clinic layout's OWN existing redirects — infrastructure this bundle does not own — before this
  // screen's client code ever runs. What a patient-only ID actually reaches today is his own patient
  // shell, not a refusal. This test documents the REAL, current behaviour rather than asserting the
  // unreachable intended one, so a regression here is caught honestly.
  test('(CR-039) a patient-only ID is currently NOT refused at X0 — it lands in حمد’s own patient shell', async ({ page }) => {
    await page.goto('/ar/clinic');
    await page.getByLabel('الرقم المدني').fill('255031200187'); // حمد — patient only, never a clinic role
    await page.getByRole('button', { name: 'متابعة' }).click();
    await expect(page).toHaveURL(/\/ar\/app(\?|$)/, { timeout: 10_000 });
  });

  test('د. خالد (dual clinic role) reaches the chooser; م. دانة (admin only) goes straight to the audit log with no chooser', async ({ page }) => {
    await page.goto('/ar/clinic');
    await page.getByLabel('الرقم المدني').fill('280012000961');
    await page.getByRole('button', { name: 'متابعة' }).click();
    await expect(page).toHaveURL(/\/ar\/clinic\/choose(\?|$)/, { timeout: 10_000 });
    await expect(page.getByText('المراجعة الطبية')).toBeVisible();
    await expect(page.getByText('إدارة النظام')).toBeVisible();

    await page.goto('/ar/clinic');
    await page.getByLabel('الرقم المدني').fill('293080700148');
    await page.getByRole('button', { name: 'متابعة' }).click();
    await expect(page).toHaveURL(/\/ar\/clinic\/audit(\/|$)/, { timeout: 10_000 });
  });

  test('the landing page never links to the clinic route', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('a[href*="/clinic"]')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// G1s / G3s — the reviewer queues, read-only content states first (before either mutating test)
// ---------------------------------------------------------------------------------------------
// CR-036: the waiting-time word each locale renders, whatever bucket ia-001's ~46h actually lands
// in (minutes/hours/days) — this checks the FORMAT ("since N <unit>"), not a hardcoded count, so it
// never depends on exactly when the suite runs relative to REFERENCE_NOW's frozen value.
const WAITED_PATTERN: Record<(typeof LOCALES)[number], RegExp> = {
  ar: /منذ [٠-٩\d]+ (دقيقة|ساعة|يوم)/,
  en: /waiting \d+ (minutes|hours|days)/,
};

test.describe('G1s — reviewer queue, interaction findings', () => {
  for (const locale of LOCALES) {
    test(`shows ia-001 (حمد, danger, Warfarin + Ibuprofen) with its waiting time, unless already reviewed — ${locale}`, async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'khalid_reviewer');
      await page.goto(`/${locale}/clinic/review`);
      const stillPending = await page.getByText('Warfarin').first().isVisible().catch(() => false);
      if (stillPending) {
        await expect(page.getByText('Warfarin + Ibuprofen')).toBeVisible();
        // CR-036 — waitedMinutes, precomputed by getReviewQueue, formatted (never derived) here.
        await expect(page.getByText(WAITED_PATTERN[locale])).toBeVisible();
      } else {
        // Already committed by an earlier run/project (G2s's own test, below) — the empty state.
        await expect(page.getByText('Warfarin + Ibuprofen')).toHaveCount(0);
      }
    });
  }

  test('the segmented switch moves to G3s in place, and back', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_reviewer');
    await page.goto('/ar/clinic/review');
    // Clicks the visible <label> text, not the underlying `role=radio` input: ChoiceGroup's own
    // anatomy (docs/design-system/bundle.css) makes the real `<input>` visually hidden and
    // positioned under its label, so a real user (and this test) interacts with the label.
    await page.getByText('تأكيد حقول', { exact: false }).click();
    await expect(page).toHaveURL(/\/ar\/clinic\/review\/fields(\/|$)/);
    await page.getByText('تعارضات', { exact: false }).click();
    await expect(page).toHaveURL(/\/ar\/clinic\/review$/);
  });
});

test.describe('G3s — reviewer queue, field confirmation', () => {
  test('shows rx-006 ((unreadable), فاطمة) with its uncertain fields, unless already actioned', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_reviewer');
    await page.goto('/ar/clinic/review/fields');
    // CR-037: (unreadable) now also appears in the quiet "returned" section once rx-006 has been
    // actioned by the mutating test below, so "still pending" is checked against the PENDING
    // section's own empty-state title, never against the drug name alone (ambiguous once returned).
    const stillPending = !(await page.getByText('ما فيه وصفات تنتظر تأكيد').isVisible().catch(() => false));
    if (stillPending) {
      await expect(page.getByText('(unreadable)').first()).toBeVisible();
      await expect(page.getByText('فاطمة', { exact: false }).first()).toBeVisible();
    }
  });

  // CR-037 — rx-007 (Ciprofloxacin, فاطمة) is `returned` in the seed itself, never mutated by this
  // suite, so this quiet history section is present on every run regardless of test order.
  test('shows rx-007 (Ciprofloxacin, فاطمة) as a quiet "returned to clinic" history row', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_reviewer');
    await page.goto('/ar/clinic/review/fields');
    await expect(page.getByText('وصفات أُرجعت للعيادة')).toBeVisible();
    await expect(page.getByText('Ciprofloxacin', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('أُرجعت للعيادة', { exact: false }).first()).toBeVisible();

    // Opens the SAME detail route G3s's own confirm/return flow uses, read-only for an already
    // -returned record (no confirm/return button, the recorded reason shown instead).
    await page.getByText('Ciprofloxacin', { exact: false }).first().click();
    await expect(page).toHaveURL(/\/ar\/clinic\/review\/fields\/rx-007$/);
    await expect(page.getByText('الجرعة المكتوبة تتعارض مع المدة', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إرجاع للعيادة' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تأكيد القيم' })).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// G2s — the wide layout (ReviewerDesktop.dc.html, 1280; D-009). Runs BEFORE the commit round-trip
// below, which empties the queue for the rest of the run; sets its own viewport (no fourth project —
// see shells.spec.ts).
// ---------------------------------------------------------------------------------------------
test('G2s at 1280 — decision beside the read-only patient context, with the queue pane', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL, 'khalid_reviewer');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/ar/clinic/review');
  const stillPending = await page.getByText('Warfarin + Ibuprofen').first().isVisible().catch(() => false);
  test.skip(!stillPending, 'ia-001 already committed by an earlier run against this dev server');
  await page.goto('/ar/clinic/review/ia-001');
  const decision = page.getByRole('heading', { name: 'القرار' });
  const patientContext = page.getByRole('heading', { name: /سياق المريض/ });
  const [d, c] = await Promise.all([decision.boundingBox(), patientContext.boundingBox()]);
  expect(d && c && Math.abs(d.x - c.x) > 100, 'decision and context in two columns').toBeTruthy();
  const pane = page.getByRole('complementary', { name: 'قوائم المراجعة' });
  await expect(pane).toBeVisible();
  // The open item is marked, not linked; nothing in the pane writes anything.
  await expect(pane.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(pane.getByRole('button')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(pane).toBeHidden();
});

// ---------------------------------------------------------------------------------------------
// G2s — reviewer decision: the commit round-trip (idempotent — see file header)
// ---------------------------------------------------------------------------------------------
test('G2s — confirm ia-001 → back to G1s, item gone → audit log gains alert_reviewed', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL, 'khalid_reviewer');
  await page.goto('/ar/clinic/review');
  const stillPending = await page.getByText('Warfarin + Ibuprofen').isVisible().catch(() => false);

  if (stillPending) {
    await page.getByText('Warfarin + Ibuprofen').click();
    await expect(page).toHaveURL(/\/ar\/clinic\/review\/ia-001$/);
    await expect(page.getByText('ما توفر مصدر طبي مؤكد', { exact: false })).toBeVisible(); // sourceCitation TO_BE_SUPPLIED → the honest line, never invented
    // The decision buttons open a client-side Sheet: a click that lands before the new document has
    // hydrated is dropped and no dialog ever appears (the same race as day.spec.ts's "return to
    // today" — see docs/VERIFICATION.md, "Responsive pass — results"). Let the client chunks settle
    // first so the click reaches a live handler.
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'تأكيد الخطر' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'تأكيد' }).click();
    await expect(page).toHaveURL(/\/ar\/clinic\/review$/, { timeout: 10_000 });
  }

  // Either way, the item is gone from G1s now.
  await page.goto('/ar/clinic/review');
  await expect(page.getByText('Warfarin + Ibuprofen')).toHaveCount(0);
  await expect(page.getByText('ما فيه تنبيهات تنتظر')).toBeVisible();

  // The audit log (through the published API, via the admin role — no direct store poke) gained
  // an alert_reviewed row for ia-001.
  await context.clearCookies();
  await addSession(context, baseURL, 'khalid_admin');
  await page.goto('/ar/clinic/audit?type=alert_reviewed');
  // The row's own audit MESSAGE, not the (ambiguous) event-type label — "مراجعة تنبيه" alone also
  // matches the (hidden, closed) event-type <select>'s own <option> text.
  // Same dual-layout visibility caveat as the "(agent)" assertion below: pick the copy that is
  // actually on screen for this viewport, not whichever one DOM order returns first.
  await expect(page.locator('.jr-activity-row__desc:visible, .jr-activity-row__cell--muted:visible', { hasText: 'مراجعة تنبيه — تأكيد' }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------------------------
// G3s — the return path (idempotent)
// ---------------------------------------------------------------------------------------------
test('G3s — return rx-006 to the clinic with a reason', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL, 'khalid_reviewer');
  // Checked against the DETAIL route directly, not the list: CR-037 means "(unreadable)" alone no
  // longer tells pending and returned apart on the list page (an already-returned rx-006 still shows
  // there, in its own quiet history section) — the presence of the return action is unambiguous.
  await page.goto('/ar/clinic/review/fields/rx-006');
  const stillPending = await page.getByRole('button', { name: 'إرجاع للعيادة' }).isVisible().catch(() => false);

  if (stillPending) {
    // getByLabel alone is ambiguous here: the surrounding <section> shares the same aria-label as
    // the TextField it contains, so this scopes to the actual input (getByRole('textbox')).
    await page.getByRole('textbox', { name: 'سبب الإرجاع' }).fill('الكتابة غير واضحة، يرجى إعادة إصدار الوصفة');
    await page.getByRole('button', { name: 'إرجاع للعيادة' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'إرجاع' }).click();
    await expect(page).toHaveURL(/\/ar\/clinic\/review\/fields$/, { timeout: 10_000 });
  }

  // Either way: rx-006 no longer sits in the pending queue, and its own detail page (still legally
  // reachable — `getFlaggedPrescription` only requires `needsReview`, which a return never clears)
  // now reads as returned, read-only, with the recorded reason and no edit controls.
  await page.goto('/ar/clinic/review/fields');
  await expect(page.getByText('ما فيه وصفات تنتظر تأكيد')).toBeVisible(); // rx-006 was the only pending item
  await page.goto('/ar/clinic/review/fields/rx-006');
  await expect(page.getByText('الكتابة غير واضحة', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إرجاع للعيادة' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'تأكيد القيم' })).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// X1 — the system audit log, the demo's proof moment
// ---------------------------------------------------------------------------------------------
test.describe('X1 — system audit log', () => {
  for (const locale of LOCALES) {
    test(`the proof moment: filtered to dose-status writes, exactly 5 rows, every actor agent/system — ${locale}`, async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'dana');
      await page.goto(`/${locale}/clinic/audit`);
      await page.getByLabel(locale === 'ar' ? 'نوع الحدث' : 'Event type').selectOption('dose_status_recorded');
      await expect(page).toHaveURL(/type=dose_status_recorded/);
      await expect(page.getByTestId('proof-moment-notice')).toBeVisible();
      const noticeText = await page.getByTestId('proof-moment-notice').innerText();
      // Arabic uses Arabic-Indic digits (٥), never Western ones (i18n/format.ts) — assert the digit
      // this locale actually renders, not a hardcoded "5".
      expect(noticeText).toMatch(locale === 'ar' ? /٥/ : /5/);
      // No literal "patient"/"caregiver"/"reviewer"/"admin" role string anywhere on this filtered view.
      for (const role of ['patient', 'caregiver', 'reviewer', 'admin']) {
        await expect(page.locator('#main-content').getByText(new RegExp(`\\(${role}\\)`))).toHaveCount(0);
      }
    });
  }

  test('the literal actor.role string appears beside its human label (CR-010’s G9 exception, X1 only)', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'dana');
    await page.goto('/ar/clinic/audit?type=dose_status_recorded');
    // AuditLogView renders both a list layout (phone/tablet) and a table layout (desktop), one of
    // them CSS-hidden per viewport — `:visible` picks whichever copy is actually on screen, since
    // `.first()` alone would return the hidden one's node in DOM order at desktop width.
    await expect(page.locator('.jr-activity-row__code:visible', { hasText: 'agent' }).first()).toBeVisible();
  });

  // CR-038 — the patient-reference slot shows the masked name `getAuditLog` now computes
  // server-side, never a full name, never a Civil ID.
  test('the patient-reference slot shows حمد’s masked name (CR-038), never his full name or Civil ID', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'dana');
    await page.goto('/ar/clinic/audit?type=alert_raised');
    // Same dual-layout visibility caveat as the "(agent)" assertion above: `:visible` picks whichever
    // of the list/table copies is actually on screen for this viewport.
    await expect(page.locator('.jr-activity-row__meta:visible, .jr-activity-row__cell:visible', { hasText: 'حمد س*** المطيري' }).first()).toBeVisible();
    await expect(page.getByText('حمد سالم المطيري')).toHaveCount(0); // the full, unmasked name
    await expect(page.getByText('255031200187')).toHaveCount(0); // his Civil ID, never printed
  });

  test('an empty filter combination shows the empty state, not an error', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'dana');
    await page.goto('/ar/clinic/audit?type=dose_status_recorded&actor=patient');
    await expect(page.getByText('ما فيه نتائج مطابقة')).toBeVisible();
  });

  test('append-only / metadata-only scope note is present, and no medication/alert/dose detail leaks in', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'dana');
    await page.goto('/ar/clinic/audit');
    await expect(page.getByText('append-only', { exact: false }).or(page.getByText('لا يُعدَّل', { exact: false }))).toBeVisible();
  });

  test('م. دانة (admin only) never sees a Review destination or any reviewer control', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'dana');
    await page.goto('/ar/clinic/audit');
    await expect(page.getByText('مراجعة', { exact: true })).toHaveCount(0);
    await expect(page.locator('#main-content').getByRole('button', { name: /تأكيد|إخلاء|إرجاع/ })).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// G7 — loading and error states, the dev-only `?view=` flag (never active in production,
// gated in each page the same way `app/[locale]/app/page.tsx` (B1) and its `?view=` originate).
// ---------------------------------------------------------------------------------------------
test.describe('G7 — loading and error states (X0, G1s, G3s, X1)', () => {
  test('X0 — ?view=loading shows a skeleton, ?view=error shows the shared error state with retry', async ({ page }) => {
    await page.goto('/ar/clinic?view=loading');
    await expect(page.getByRole('status')).toBeVisible();
    await page.goto('/ar/clinic?view=error');
    await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
    await expect(page.getByText('صار خطأ عندنا')).toBeVisible();
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(page).toHaveURL(/\/ar\/clinic$/);
  });

  test('G1s — ?view=loading shows a skeleton, ?view=error shows the shared error state with retry', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_reviewer');
    await page.goto('/ar/clinic/review?view=loading');
    await expect(page.getByRole('status')).toBeVisible();
    await page.goto('/ar/clinic/review?view=error');
    await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(page).toHaveURL(/\/ar\/clinic\/review$/);
  });

  test('G3s — ?view=loading shows a skeleton, ?view=error shows the shared error state with retry', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_reviewer');
    await page.goto('/ar/clinic/review/fields?view=loading');
    await expect(page.getByRole('status')).toBeVisible();
    await page.goto('/ar/clinic/review/fields?view=error');
    await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(page).toHaveURL(/\/ar\/clinic\/review\/fields$/);
  });

  test('X1 — ?view=loading shows a skeleton, ?view=error shows the shared error state with retry', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'dana');
    await page.goto('/ar/clinic/audit?view=loading');
    await expect(page.getByRole('status')).toBeVisible();
    await page.goto('/ar/clinic/audit?view=error');
    await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(page).toHaveURL(/\/ar\/clinic\/audit$/);
  });
});

// ---------------------------------------------------------------------------------------------
// axe accessibility sweep, one representative screen per group, ar + en.
// ---------------------------------------------------------------------------------------------
test.describe('axe clean', () => {
  for (const locale of LOCALES) {
    test(`X0 sign-in is axe-clean — ${locale}`, async ({ page }) => {
      const { default: AxeBuilder } = await import('@axe-core/playwright');
      await page.goto(`/${locale}/clinic`);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });

    test(`X1 audit log is axe-clean — ${locale}`, async ({ page, context, baseURL }) => {
      const { default: AxeBuilder } = await import('@axe-core/playwright');
      await addSession(context, baseURL, 'dana');
      await page.goto(`/${locale}/clinic/audit`);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
});
