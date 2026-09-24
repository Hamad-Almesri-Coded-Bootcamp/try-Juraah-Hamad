import type { ReactNode } from 'react';

/**
 * SkyHeader (CR-071, a Daylight addition): the navy "sky" at the top of a home screen — a greeting,
 * the screen's one h1, the bar's actions (assistant, language), and whatever the screen puts under
 * it (the week strip and the day dial on Today). The section after it overlaps it as a sheet
 * (`.jr-sheet`). From 834px it becomes a rounded panel inside the content column.
 */
export interface SkyHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function SkyHeader({ eyebrow, title, subtitle, actions, children, className }: SkyHeaderProps) {
  return (
    <header className={['jr-sky', className].filter(Boolean).join(' ')}>
      <div className="jr-sky__top">
        <div className="jr-sky__heading">
          {eyebrow ? <span className="jr-sky__eyebrow type-body-small">{eyebrow}</span> : null}
          <h1 className="jr-sky__title">{title}</h1>
          {subtitle ? <span className="jr-sky__subtitle">{subtitle}</span> : null}
        </div>
        {actions}
      </div>
      {children}
    </header>
  );
}
