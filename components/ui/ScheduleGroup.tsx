import { useId } from 'react';
import type * as React from 'react';
import './styles/ScheduleGroup.css';
import { Icon } from './Icon';

export interface ScheduleGroupProps {
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
export function ScheduleGroup({ timeLabel, children, className }: ScheduleGroupProps) {
  const headId = useId();
  const classes = ['jr-schedule-group', className].filter(Boolean).join(' ');
  return (
    <section className={classes} aria-labelledby={headId}>
      <div id={headId} className="jr-schedule-group__head type-label">
        <Icon name="clock" small />
        <span>{timeLabel}</span>
      </div>
      <div className="jr-schedule-group__rows">{children}</div>
    </section>
  );
}
