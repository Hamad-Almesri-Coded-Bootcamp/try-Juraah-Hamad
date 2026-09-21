import type * as React from 'react';
import './styles/DoseTimeline.css';
import { StatusPill, type DoseStatus } from './StatusPill';
import type { Locale } from '@/i18n';

export interface DoseTimelineItem {
  /** Already-formatted relative day, e.g. "اليوم" / "أمس" / "Today" / "Yesterday". */
  dateLabel: React.ReactNode;
  /** Already-formatted clock time. */
  timeLabel: React.ReactNode;
  status: DoseStatus;
  /** false renders no pill for this row — never chosen by `status`. Default true. */
  tracked?: boolean;
}

export interface DoseTimelineProps {
  items: DoseTimelineItem[];
  lang?: Locale;
  className?: string;
}

/**
 * A compact vertical history of a prescription's doses with their statuses, for the prescription
 * detail and the reviewer's patient-context panel (Build Prompts prompt 1). Read-only, and correct
 * with no statuses at all — the untracked patient's history is simply a list of times.
 */
export function DoseTimeline({ items, lang = 'en', className }: DoseTimelineProps) {
  const classes = ['jr-dose-timeline', className].filter(Boolean).join(' ');
  return (
    <ol className={classes}>
      {items.map((item, i) => (
        <li key={i} className="jr-dose-timeline__row">
          <span className="jr-dose-timeline__when type-body-small">
            {item.dateLabel} {item.timeLabel}
          </span>
          {item.tracked !== false ? <StatusPill status={item.status} lang={lang} /> : null}
        </li>
      ))}
    </ol>
  );
}
