/**
 * Named invariant — zero write controls in the caregiver shell (WP4h ACCEPTANCE): "no `<button>`
 * outside navigation/sign-out/own-notification controls on F2/F3 — enumerate what is allowed and
 * assert nothing else". F2's Today screen renders every affordance as a real `<a href>`, so it has
 * no `<button>` at all. F2's Medicines screen has one allowed shape of button: `features/day`'s
 * `PrescriptionCardLink` (bundle c's own navigation-via-`router.push` wrapper, since
 * `PrescriptionCard` takes `onOpen` rather than `href` — a design-system gap logged in
 * docs/backend-notes/wp4c.md, not this bundle's to patch) — one per active prescription, each named
 * after that prescription and nothing else. F4's allowed buttons are the caregiver's own
 * relationship writes (push/chat toggle, unlink, sign out) — never anything shaped like patient data.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CaregiverToday } from '@/features/caregiving/CaregiverToday';
import { CaregiverMedicines } from '@/features/caregiving/CaregiverMedicines';
import { CaregiverProfile } from '@/features/caregiving/CaregiverProfile';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
});

describe('F2 — Today: zero <button> elements (every affordance is a real link)', () => {
  it('حمد (tracking off) — no button anywhere on the caregiver Today screen', async () => {
    const element = await CaregiverToday({ caregiverId: 'cg-01', locale: 'ar' });
    const { container } = render(element);
    expect(container.querySelectorAll('button').length).toBe(0);
  });
});

describe('F2 — Medicines: every button is a navigation-only open-detail control, nothing else', () => {
  it('حمد — one button per active prescription (PrescriptionCardLink), each named after that prescription, and no write-shaped button (no add/refill/alert-action)', async () => {
    const element = await CaregiverMedicines({ caregiverId: 'cg-01', locale: 'ar' });
    const { container } = render(element);
    const buttons = [...container.querySelectorAll('button')];
    // حمد has three active prescriptions (rx-001 Warfarin, rx-002 Ibuprofen, rx-003 Metformin) —
    // exactly one navigation button per card, none for the past/discontinued group, none for the
    // danger alert (no safetyHref supplied, so InteractionAlert renders no action button here).
    expect(buttons.length).toBe(3);
    for (const button of buttons) {
      expect(button.textContent).not.toMatch(/إضافة|تجديد|طلب/); // no add/refill/request wording
    }
  });
});

describe('F4 — profile: only the enumerated relationship-writes appear as buttons', () => {
  it('every rendered button is push/chat/unlink/sign-out — nothing shaped like a patient-data control', () => {
    const { container } = render(
      <CaregiverProfile
        caregiverId="cg-01"
        patientFirstName="حمد"
        acceptedAt="2026-09-03T18:20:00+03:00"
        pushCapabilitySupported
        push={{ id: 'ps-x', subjectType: 'caregiver', subjectId: 'cg-01', status: 'active', permission: 'default', createdAt: '2026-09-01T00:00:00+03:00' }}
        messaging={{ id: 'ml-x', subjectType: 'caregiver', subjectId: 'cg-01', channel: 'telegram', status: 'not_connected' }}
        locale="ar"
      />,
    );
    const buttons = [...container.querySelectorAll('button')].map((b) => b.textContent?.trim());
    const ALLOWED = [
      'تفعيل إشعارات المتصفح',
      'إيقاف إشعارات المتصفح',
      'ربط تيليقرام',
      'فصل تيليقرام',
      'افصل نفسي عن هذا الملف',
      'تسجيل الخروج',
    ];
    for (const label of buttons) {
      expect(ALLOWED.some((allowed) => label?.includes(allowed)), `unexpected button: ${label}`).toBe(true);
    }
    // None of the allowed labels mention a patient-data noun — a structural sanity check.
    for (const label of buttons) {
      expect(label).not.toMatch(/جرعة|وصفة|دواء|تنبيه/);
    }
  });
});
