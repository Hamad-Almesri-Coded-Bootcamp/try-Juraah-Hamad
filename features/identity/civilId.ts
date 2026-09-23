import { copy } from '@/i18n';

/**
 * The Civil ID field's own checks, shared by A1 (`SignInForm`) and X0 (`ClinicSignInForm`) so the two
 * doors validate identically — "same simulation, same states as A1" (SCREENS.md, X0). Validation runs
 * on submit, never as disabled-until-valid (audit M14, UX Principles §5/§6): each message says what to
 * do next, sits in the field's own error slot, and the field's value is never rewritten or cleared.
 * `not_in_test_list` keeps ONE wording for every ID, account or not (CLAUDE.md rule 6).
 */

/** A Kuwaiti Civil ID is exactly twelve digits. */
export const CIVIL_ID_PATTERN = /^\d{12}$/;

export type CivilIdFieldError = 'required' | 'length' | 'not_in_test_list';

export const CIVIL_ID_ERROR_COPY = {
  required: copy.identity.civilIdRequiredError,
  length: copy.identity.civilIdLengthError,
  not_in_test_list: copy.identity.invalidIdError,
} as const;

/** What was typed, as the ASCII digits `signIn` compares: spaces dropped, and Arabic-Indic or
 * Extended Arabic-Indic digits (an Arabic keyboard's) read as the digits they are. */
export function normaliseCivilId(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** The problem with a typed Civil ID before it is ever sent, or null when it is well-formed. */
export function civilIdProblem(normalised: string): 'required' | 'length' | null {
  if (!normalised) return 'required';
  if (!CIVIL_ID_PATTERN.test(normalised)) return 'length';
  return null;
}
