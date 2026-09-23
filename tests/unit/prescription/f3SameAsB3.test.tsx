/**
 * F3 is B3 minus its actions (UX Principles §10 — "identical to the patient's view minus actions";
 * §3 — one word per concept). Audit M10 found the caregiver's prescription detail using different
 * labels for the same fields ("Dose per administration" vs "Dose", "Prescriber" vs "Prescribing
 * doctor", "Start date" vs "Starts on", …), a bare "1" for the dose (M9) and the same 90-row flat
 * history (M8). Rendered against the real mock store, both screens, same prescription.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CaregiverPrescriptionDetail } from '@/features/caregiving/CaregiverPrescriptionDetail';
import { PrescriptionDetail } from '@/features/prescription/PrescriptionDetail';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

beforeEach(() => reset());

function labels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.wsf-dr__label')].map((el) => el.textContent ?? '');
}

async function renderF3(prescriptionId: string, locale: 'ar' | 'en') {
  setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
  return render(await CaregiverPrescriptionDetail({ prescriptionId, locale }));
}

async function renderB3(prescriptionId: string, locale: 'ar' | 'en') {
  setScriptSession({ subjectId: 'pt-01', role: 'patient' });
  return render(await PrescriptionDetail({ prescriptionId, locale, emptyBackHref: `/${locale}/app/medicines` }));
}

describe('F3 uses exactly B3’s field labels (audit M10)', () => {
  for (const locale of ['en', 'ar'] as const) {
    it(`rx-001, ${locale}: the same label for every field, none of the caregiver-only variants`, async () => {
      const b3 = labels((await renderB3('rx-001', locale)).container);
      cleanup();
      const f3View = await renderF3('rx-001', locale);
      const f3 = labels(f3View.container);
      expect(new Set(f3)).toEqual(new Set(b3));
      expect(f3View.container.textContent).not.toMatch(/Dose per administration|Prescriber\b(?! )|Start date|Dispense date|Total quantity dispensed|Duration \(days\)/);
    });
  }
});

describe('F3 reads the dose as a person says it and formats numbers for the language (audit M9, M7)', () => {
  it('rx-001, ar: الجرعة reads حبة واحدة; strength ٥ ملغم; no Latin unit, no bare Western digit in the fields', async () => {
    const { container } = await renderF3('rx-001', 'ar');
    const text = container.textContent ?? '';
    expect(text).toContain('الجرعةحبة واحدة');
    expect(text).toContain('٥ ملغم');
    expect(text).toContain('المدة٩٠ يومًا');
    expect(text).not.toMatch(/\bmg\b/);
    const fieldValues = [...container.querySelectorAll('.wsf-dr__value')].map((el) => el.textContent ?? '');
    for (const v of fieldValues) expect(v).not.toMatch(/[0-9]/);
  });
});

describe('F3’s dose history is the same window as B3’s (audit M8)', () => {
  it('rx-001: 13 rows around today, the plan under its own heading, no pill (حمد is untracked), no write control', async () => {
    const { container } = await renderF3('rx-001', 'en');
    expect(container.querySelectorAll('.jr-dose-timeline__row').length).toBe(13);
    expect(container.textContent).toContain('Planned doses');
    expect(container.querySelectorAll('[data-testid="status-pill"]').length).toBe(0);
    const buttons = [...container.querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons.every((label) => /^Show all \d+ (past|planned) doses$/.test(label ?? ''))).toBe(true);
  });
});
