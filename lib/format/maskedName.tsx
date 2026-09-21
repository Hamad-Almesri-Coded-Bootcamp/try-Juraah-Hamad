/**
 * The masked-name formatter (CR-021; G9; CLAUDE.md rule 6): first and family name in full, each
 * middle name as its initial plus EXACTLY three asterisks whatever the real length, two-part names
 * unchanged. Not a design-system component ("There is no component for this … Do NOT add a
 * MaskedName component" — Build Prompts.md prompt 1, CR-021) — one formatter, used everywhere a
 * name must be masked (F1, F0, audit messages, …).
 *
 * Honorific prefixes ("د.", "م.") are not a name part and are stripped before masking, so
 * "د. خالد عبدالرحمن الرشيد" masks the same way a patient-typed name would.
 */
import type { ReactElement } from 'react';

const HONORIFICS = new Set(['د.', 'م.']);

interface NameParts {
  first: string;
  middles: string[];
  last: string;
}

function splitName(fullName: string): NameParts | null {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  const parts = tokens[0] && HONORIFICS.has(tokens[0]) ? tokens.slice(1) : tokens;
  if (parts.length === 0) return null;
  if (parts.length <= 2) return { first: parts.join(' '), middles: [], last: '' };
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const middles = parts.slice(1, -1);
  return { first, middles, last };
}

/** The masked name as a plain string — for audit messages and anywhere JSX cannot be used. */
export function maskName(fullName: string): string {
  const parts = splitName(fullName);
  if (!parts) return '';
  if (parts.middles.length === 0) return [parts.first, parts.last].filter(Boolean).join(' ');
  const maskedMiddles = parts.middles.map((m) => `${[...m][0] ?? ''}***`);
  return [parts.first, ...maskedMiddles, parts.last].join(' ');
}

/**
 * The masked name as marked-up `body-strong` text (CR-021): the asterisk runs are `aria-hidden`,
 * so assistive technology reads the visible name and skips only the decorative asterisks — never
 * mirrored, since digits and Latin-script drug names are the only things that mirror in this
 * product and a masked name is neither.
 */
export function MaskedName({ fullName, className }: { fullName: string; className?: string }): ReactElement {
  const parts = splitName(fullName);
  const cls = ['type-body-strong', className].filter(Boolean).join(' ');
  if (!parts) return <span className={cls} />;
  if (parts.middles.length === 0) {
    return <span className={cls}>{[parts.first, parts.last].filter(Boolean).join(' ')}</span>;
  }
  return (
    <span className={cls}>
      {parts.first}
      {parts.middles.map((m, i) => (
        <span key={i}>
          {' '}
          {[...m][0] ?? ''}
          <span aria-hidden="true">***</span>
        </span>
      ))}
      {' '}
      {parts.last}
    </span>
  );
}
