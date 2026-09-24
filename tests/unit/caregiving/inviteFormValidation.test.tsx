/**
 * F1's invite form checks on Continue, never before (UX Principles §5/§6; the sign-in form's
 * pattern, audit M14). Continue is never disabled-until-filled; pressing it (or Enter) with a field
 * empty keeps the person on the form with ONE specific message per empty field, and asks the data
 * layer nothing. An Arabic keyboard's digits are read as the Civil ID they are, as A1 reads them.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InviteSheet } from '@/features/caregiving/InviteSheet';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'pt-01', role: 'patient' });
});

const label = (key: 'f1CivilIdLabel' | 'f1NameKnownLabel' | 'f1RelationshipLabel', locale: Locale) =>
  screen.getByLabelText(t(copy.caregiving[key], locale));

describe('F1 invite form — a real form with a message per empty field', () => {
  for (const locale of ['ar', 'en'] as const) {
    it(`${locale}: Continue is enabled on an empty form; pressing it names each empty field and stays on the form`, () => {
      render(<InviteSheet patientId="pt-01" locale={locale} onDone={() => {}} />);
      const continueButton = screen.getByRole('button', { name: t(copy.caregiving.f1ContinueButton, locale) });
      expect(continueButton).not.toBeDisabled();
      expect(continueButton).toHaveAttribute('type', 'submit');
      expect(continueButton.closest('form')).not.toBeNull();

      fireEvent.click(continueButton);

      expect(screen.getByText(t(copy.caregiving.f1CivilIdRequiredError, locale))).toBeInTheDocument();
      expect(screen.getByText(t(copy.caregiving.f1NameRequiredError, locale))).toBeInTheDocument();
      expect(screen.getByText(t(copy.caregiving.f1RelationshipRequiredError, locale))).toBeInTheDocument();
      expect(label('f1CivilIdLabel', locale)).toHaveAttribute('aria-invalid', 'true');
      expect(label('f1NameKnownLabel', locale)).toHaveAttribute('aria-invalid', 'true');
      expect(label('f1RelationshipLabel', locale)).toHaveAttribute('aria-invalid', 'true');
      // Still on step one: no lookup ran, nothing was created.
      expect(screen.queryByText(t(copy.caregiving.f1ConfirmQuestion, locale))).toBeNull();
      expect(screen.queryByTestId('invite-created-panel')).toBeNull();
    });
  }

  it('only the field still empty keeps its message; a short Civil ID gets the length message', () => {
    render(<InviteSheet patientId="pt-01" locale="ar" onDone={() => {}} />);
    fireEvent.change(label('f1CivilIdLabel', 'ar'), { target: { value: '12345' } });
    fireEvent.change(label('f1NameKnownLabel', 'ar'), { target: { value: 'منى' } });
    fireEvent.submit(label('f1CivilIdLabel', 'ar').closest('form')!); // what Enter in a field does

    expect(screen.getByText(t(copy.caregiving.f1CivilIdError, 'ar'))).toBeInTheDocument();
    expect(screen.queryByText(t(copy.caregiving.f1NameRequiredError, 'ar'))).toBeNull();
    expect(screen.getByText(t(copy.caregiving.f1RelationshipRequiredError, 'ar'))).toBeInTheDocument();
  });

  it('Arabic-Indic digits are read as the Civil ID they are (the has-account path reaches the masked name)', async () => {
    render(<InviteSheet patientId="pt-01" locale="ar" onDone={() => {}} />);
    fireEvent.change(label('f1CivilIdLabel', 'ar'), { target: { value: '٢٨٥٠٦١٤٠٠٤١٢' } }); // 285061400412
    fireEvent.change(label('f1NameKnownLabel', 'ar'), { target: { value: 'عبدالله' } });
    fireEvent.change(label('f1RelationshipLabel', 'ar'), { target: { value: 'ابني' } });
    fireEvent.click(screen.getByRole('button', { name: t(copy.caregiving.f1ContinueButton, 'ar') }));

    await waitFor(() => expect(screen.getByText(t(copy.caregiving.f1ConfirmQuestion, 'ar'))).toBeInTheDocument());
    // Masked: middle names are an initial plus exactly three asterisks (rule 6).
    expect(document.body.textContent).toContain('عبدالله م*** ع*** المطيري');
  });

  it('en: the masked name keeps its shape in English and shows no Arabic script', async () => {
    const { baseElement } = render(<InviteSheet patientId="pt-01" locale="en" onDone={() => {}} />);
    fireEvent.change(label('f1CivilIdLabel', 'en'), { target: { value: '288110300229' } });
    fireEvent.change(label('f1NameKnownLabel', 'en'), { target: { value: 'Nasser' } });
    fireEvent.change(label('f1RelationshipLabel', 'en'), { target: { value: 'my son' } });
    fireEvent.click(screen.getByRole('button', { name: t(copy.caregiving.f1ContinueButton, 'en') }));

    await waitFor(() => expect(screen.getByText(t(copy.caregiving.f1ConfirmQuestion, 'en'))).toBeInTheDocument());
    const sheet = baseElement.querySelector('.wsf-sheet')!;
    expect(sheet.textContent).toMatch(/H\*\*\*/);
    expect(sheet.textContent?.match(/\*/g)?.length).toBe(3);
    expect(sheet.textContent).not.toMatch(/[؀-ۿ]/);
  });
});
