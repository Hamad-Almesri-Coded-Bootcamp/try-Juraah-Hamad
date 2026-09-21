/**
 * Copy catalogue entry point. WP0 creates the shape; WP1 owns this file from Gate 1 on and adds
 * the vocabulary file and the per-bundle catalogues (i18n/copy/<bundle>.ts, D-003).
 */
import type { Locale } from './locale';
import { shell, type CopyEntry } from './copy/shell';
import { vocabulary } from './copy/vocabulary';

export * from './locale';
export type { CopyEntry };

export const copy = { shell, vocabulary } as const;

/** Resolve one catalogue entry for a locale. */
export function t(entry: CopyEntry, locale: Locale): string {
  return entry[locale];
}
