import { useId } from 'react';
import type * as React from 'react';

export interface ScheduleGroupProps {
  /** A short line beside the heading ("2 doses", the times in this part of the day). */
  caption?: React.ReactNode;
  /** Already-formatted clock time, e.g. "٨:٠٠ ص" or "8:00 AM". No date maths done here. */
  timeLabel: React.ReactNode;
  /** One or several DoseRows. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The clock-time header grouping one time's DoseRows — correct with one row and with several
 * (Build Prompts prompt 1). Read-only: it groups and labels; it offers no affordance of its own.
 * The clock glyph never mirrors under dir="rtl" (it depicts a real-world object, not a direction).
 */
export function ScheduleGroup({ timeLabel, caption, children, className }: ScheduleGroupProps) {
  const headId = useId();
  const classes = ['jr-schedule-group', className].filter(Boolean).join(' ');
  return (
    <section className={classes} aria-labelledby={headId}>
      <div className="jr-schedule-group__head">
        <span id={headId} className="jr-schedule-group__name">
          {timeLabel}
        </span>
        {caption ? <span className="jr-schedule-group__meta type-body-small">{caption}</span> : null}
      </div>
      <div className="jr-schedule-group__rows">{children}</div>
    </section>
  );
}
