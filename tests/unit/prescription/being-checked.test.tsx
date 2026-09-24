/**
 * AP-10 / CR-089 — the "being checked" state on the screens that show a prescription to the patient:
 * B2's card line (features/day/MedicinesList.tsx) and B3's notice (features/prescription/
 * PrescriptionDetail.tsx), against the real mock store: a prescription the patient has just saved
 * reads "being checked"; the seed's never do; with screening not running (production today) nothing
 * does; and the state is information, never an alert (no danger or warning ink, no alert role).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PrescriptionDetail } from '@/features/prescription/PrescriptionDetail';
import { MedicinesList } from '@/features/day/MedicinesList';
import { copy, t } from '@/i18n';
import { localizeDrugName } from '@/i18n/localize';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';
import * as mock from '@/lib/data/mock-impl';
import { buildPrescriptions } from '@/lib/data/mock/seed';
import type { InteractionAlert } from '@/types/contracts';

const live = vi.hoisted(() => ({ value: true, activityReads: 0 }));
vi.mock('@/lib/agent-webhooks/state', () => ({ newPrescriptionsAwaitScreening: () => live.value }));
// Counts B3's reads of the audit rows; everything else is the real seam over the mock store.
vi.mock('@/lib/data', async (orig) => {
  const real = await orig<typeof import('@/lib/data')>();
  return { ...real, getActivity: (...args: Parameters<typeof real.getActivity>) => { live.activityReads++; return real.getActivity(...args); } };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => { cleanup(); setScriptSession(null); });
beforeEach(() => { reset(); live.value = true; live.activityReads = 0; });

/** حمد saves the stub's confident Ibuprofen photo (150 bytes), exactly as B4 does. */
async function hamadSavesANewPrescription(): Promise<string> {
  setScriptSession({ subjectId: 'pt-01', role: 'patient' });
  const draft = await mock.submitPrescriptionImage('pt-01', new Blob([new Uint8Array(150)]));
  if (draft.kind !== 'confident') throw new Error(`expected a confident draft, got ${draft.kind}`);
  return (await mock.savePrescriptionDraft('pt-01', draft.draftId)).id;
}

describe('B3 · the notice', () => {
  for (const locale of ['en', 'ar'] as const) {
    it(`a prescription just saved reads "being checked", in plain words, as information (${locale})`, async () => {
      const id = await hamadSavesANewPrescription();
      render(await PrescriptionDetail({ prescriptionId: id, locale, emptyBackHref: `/${locale}/app/medicines` }));
      const title = screen.getByText(t(copy.prescription.rxBeingCheckedTitle, locale));
      const notice = title.closest('[role="status"]') as HTMLElement;
      expect(notice).not.toBeNull(); // InlineNotice: announced politely (UX §11), never role="alert"
      expect(within(notice).getByText(t(copy.prescription.rxBeingCheckedBody, locale))).toBeInTheDocument();
      expect(notice.className).toContain('wsf-notice--info');
      expect(notice.className).not.toMatch(/danger|warning/);
      expect(live.activityReads).toBe(1);
    });
  }
  it('a seed prescription never reads "being checked"', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    render(await PrescriptionDetail({ prescriptionId: 'rx-001', locale: 'en', emptyBackHref: '/en/app/medicines' }));
    expect(screen.queryByText(t(copy.prescription.rxBeingCheckedTitle, 'en'))).not.toBeInTheDocument();
  });
  it('screening not running on this server (production today): no notice, even for a new prescription, and no extra read', async () => {
    live.value = false;
    const id = await hamadSavesANewPrescription();
    render(await PrescriptionDetail({ prescriptionId: id, locale: 'en', emptyBackHref: '/en/app/medicines' }));
    expect(screen.queryByText(t(copy.prescription.rxBeingCheckedTitle, 'en'))).not.toBeInTheDocument();
    expect(live.activityReads).toBe(0); // the page loads exactly what it loaded before AP-10
  });
});

describe('B2 · the card line', () => {
  const seed = buildPrescriptions().filter((p) => p.patientId === 'pt-01');
  const props = { alerts: [] as InteractionAlert[], nextDoseByPrescriptionId: {}, tracked: false, hrefBuilder: null, alertHrefBuilder: null };
  for (const locale of ['en', 'ar'] as const) {
    it(`only the card being checked carries the line, in neutral ink (${locale})`, () => {
      render(<MedicinesList {...props} prescriptions={seed} locale={locale} beingCheckedIds={new Set(['rx-003'])} />);
      const lines = screen.getAllByTestId('rx-being-checked');
      expect(lines).toHaveLength(1);
      expect(lines[0]!.textContent).toBe(t(copy.prescription.rxBeingCheckedLine, locale));
      expect(lines[0]!.className).toContain('text-ink-muted');
      expect(lines[0]!.className).not.toMatch(/danger|warning/);
      expect(lines[0]!.closest('.wsf-rx')!.textContent).toContain(localizeDrugName('Glucophage', locale));
    });
  }
  it('no ids (the caregiver\'s F2, or nothing new) → no card carries it', () => {
    render(<MedicinesList {...props} prescriptions={seed} locale="en" />);
    expect(screen.queryAllByTestId('rx-being-checked')).toHaveLength(0);
  });
});
