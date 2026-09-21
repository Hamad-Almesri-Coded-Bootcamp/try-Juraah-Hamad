import { Icon } from './Icon';
import { copy, t, type Locale } from '@/i18n';
import type { Dose } from '@/types/contracts';

/** Dose.status, narrowed locally per docs/design-system/index.d.ts (DoseStatus). */
export type DoseStatus = Dose['status'];

const ICON_BY_STATUS: Record<DoseStatus, 'clock' | 'check' | 'checkLate' | 'missed'> = {
  upcoming: 'clock',
  taken_on_time: 'check',
  taken_late: 'checkLate',
  missed: 'missed',
};

export interface StatusPillProps {
  status: DoseStatus;
  /** Overrides the built-in word. The glyph stays, so the status is never carried by colour alone. */
  label?: string;
  lang?: Locale;
  className?: string;
}

/**
 * The four dose statuses, each rendered as its own glyph and its own word so hue is never the only
 * signal (brand book status table). Ported from docs/design-system/components/StatusPill.md against
 * bundle.css's `.wsf-pill` / `.wsf-pill--<status>` anatomy.
 */
export function StatusPill({ status, label, lang = 'en', className }: StatusPillProps) {
  const classes = ['wsf-pill', `wsf-pill--${status}`, className].filter(Boolean).join(' ');
  const word = label ?? t(copy.vocabulary[status], lang);
  return (
    <span className={classes} data-testid="status-pill">
      <Icon name={ICON_BY_STATUS[status]} small />
      <span className="type-label">{word}</span>
    </span>
  );
}
