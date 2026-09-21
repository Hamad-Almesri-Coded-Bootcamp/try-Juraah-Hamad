/**
 * Day grouping — the slice `getDosesForDay` needs: every dose of one calendar day, ascending by
 * time. Pure; takes the day as an argument, never reads the clock.
 */
import type { Dose } from '@/types/contracts';
import { dateOf } from './dates';

export function dosesOnDate<T extends Pick<Dose, 'scheduledAt'>>(doses: T[], isoDate: string): T[] {
  return doses
    .filter((d) => dateOf(d.scheduledAt) === isoDate)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
