/**
 * Copy catalogue entry point. WP0 creates the shape; WP1 owns this file from Gate 1 on and adds
 * the vocabulary file and the per-bundle catalogues (i18n/copy/<bundle>.ts, D-003).
 */
import type { Locale } from './locale';
import { shell, type CopyEntry } from './copy/shell';
import { vocabulary } from './copy/vocabulary';
import { landing } from './copy/landing';
import { identity } from './copy/identity';
import { day } from './copy/day';
import { caregiving } from './copy/caregiving';
import { prescription } from './copy/prescription';
import { safety } from './copy/safety';
import { clinic } from './copy/clinic';
import { supply } from './copy/supply';
import { ambient } from './copy/ambient';
import { assistant } from './copy/assistant';

export * from './locale';
export type { CopyEntry };

export const copy = {
  shell,
  vocabulary,
  landing,
  identity,
  day,
  caregiving,
  prescription,
  safety,
  clinic,
  supply,
  ambient,
  assistant,
} as const;

/** Resolve one catalogue entry for a locale. */
export function t(entry: CopyEntry, locale: Locale): string {
  return entry[locale];
}
