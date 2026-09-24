import { Fragment } from 'react';
import type { Locale } from '@/i18n/locale';

/**
 * Text a person wrote, shown as they wrote it (CR-071). The localisation tables translate the seed
 * and the app's own sentences; a reason a reviewer typed, a name a patient entered or a drug read
 * from a new photo cannot be translated in Phase 1. Rather than print it unmarked, every run of the
 * other script is declared with its language (`lang` + `dir`), so a screen reader switches voice,
 * the run keeps its own direction inside the line, and the one-language check knows it is quoted
 * data, not interface copy. Phase 2 stores both languages (docs/BACKEND-NOTES.md).
 */
const RUNS: Record<Locale, RegExp> = {
  // In Arabic: a run of Latin words (a new drug name, an English note).
  ar: /[A-Za-z][A-Za-z0-9'’.+\-]*(?:[\s,/]+[A-Za-z0-9][A-Za-z0-9'’.+\-]*)*/g,
  // In English: a run of Arabic words, masked initials (ح***) included.
  en: /[؀-ۿ][؀-ۿً-ٟ*]*(?:[\s،.]+[؀-ۿ][؀-ۿً-ٟ*]*)*/g,
};

export function AsWritten({ text, locale }: { text: string | null | undefined; locale: Locale }) {
  if (!text) return null;
  const re = RUNS[locale];
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <span key={start} lang={locale === 'ar' ? 'en' : 'ar'} dir={locale === 'ar' ? 'ltr' : 'rtl'}>
        {m[0]}
      </span>,
    );
    last = start + m[0].length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => (typeof p === 'string' ? <Fragment key={`t${i}`}>{p}</Fragment> : p))}</>;
}
