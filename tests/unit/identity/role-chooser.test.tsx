/**
 * A1b (RoleChooser) — two equally weighted cards (§2), `chooseRole` then navigate to that role's
 * own shell home, never a sign-out (ROLES.md). `@/lib/session` mocked, per this repo's convention
 * of never calling the `'use server'` wrapper directly from a unit test.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { localizeFirstName, localizeRelationship } from '@/i18n/localize';
import type { RoleOption } from '@/types/views';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const chooseRoleMock = vi.fn(async (option: RoleOption) => ({ subjectId: option.subjectId, role: option.role, linkedPatientId: option.linkedPatientId }));
vi.mock('@/lib/session', () => ({ chooseRole: (option: RoleOption) => chooseRoleMock(option) }));

const { RoleChooser } = await import('@/features/identity/RoleChooser');

const options: RoleOption[] = [
  { role: 'patient', subjectId: 'pt-03' },
  { role: 'caregiver', subjectId: 'cg-02', linkedPatientId: 'pt-01', patientFirstName: 'حمد', relationship: 'ابني' },
];

beforeEach(() => {
  pushMock.mockClear();
  chooseRoleMock.mockClear();
});
afterEach(() => cleanup());

// CR-071: the patient's name and the relationship they typed show in the reader's language.
const caregiverButtonEn = interpolate(t(copy.identity.roleChooserCaregiverButtonTemplate, 'en'), { name: localizeFirstName('حمد', 'en') });

describe('A1b — role chooser', () => {
  it('renders two equally weighted cards, own record and the caregiver record named by relationship', () => {
    render(<RoleChooser options={options} locale="en" />);
    const own = screen.getByRole('button', { name: t(copy.identity.roleChooserOwnButton, 'en') });
    const theirs = screen.getByRole('button', { name: caregiverButtonEn });
    // Equal weight (UX §2, audit M2): the same variant, size and width, neither primary.
    expect([...own.classList].sort()).toEqual([...theirs.classList].sort());
    expect(own).toHaveClass('wsf-btn--secondary');
    // The relationship is the PATIENT's own first-person label ('ابني' = "my son"), so it is quoted,
    // never shown bare under the patient's name as if it described the reader (audit M4).
    expect(
      screen.getByText(interpolate(t(copy.identity.roleChooserRelationshipTemplate, 'en'), { relationship: localizeRelationship('ابني', 'en') })),
    ).toBeInTheDocument();
    expect(screen.queryByText('ابني')).not.toBeInTheDocument();
    // One language per locale (CR-071): no Arabic script on the English screen.
    expect(document.body.textContent ?? '').not.toMatch(/[؀-ۿ]/);
  });

  it('ar: the relationship reads as a quote, «ابني»', () => {
    render(<RoleChooser options={options} locale="ar" />);
    expect(screen.getByText(interpolate(t(copy.identity.roleChooserRelationshipTemplate, 'ar'), { relationship: 'ابني' }))).toBeInTheDocument();
    expect(screen.getByText(/«ابني»/)).toBeInTheDocument();
  });

  it('has exactly one h1, the question (the wordmark is not a heading)', () => {
    render(<RoleChooser options={options} locale="en" />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([t(copy.identity.roleChooserTitle, 'en')]);
  });

  it('choosing "my medicines" calls chooseRole with the patient option and routes to /app', async () => {
    render(<RoleChooser options={options} locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.roleChooserOwnButton, 'en') }));
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/app'));
    expect(chooseRoleMock).toHaveBeenCalledWith(options[0]);
  });

  it('choosing the caregiver record calls chooseRole with the caregiver option and routes to /care — never signing out', async () => {
    render(<RoleChooser options={options} locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: caregiverButtonEn }));
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/care'));
    expect(chooseRoleMock).toHaveBeenCalledWith(options[1]);
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining('signin'));
  });

  it('a single-role option list renders only one card', () => {
    render(<RoleChooser options={[options[0]!]} locale="en" />);
    expect(screen.queryByText(/ابني/)).not.toBeInTheDocument();
  });
});
