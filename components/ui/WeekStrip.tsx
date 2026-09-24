import Link from 'next/link';

/**
 * WeekStrip (CR-071, a Daylight addition): seven days as tappable tiles — today outlined, the day on
 * screen filled. Each tile is a visible link (no swipe), with a full date as its accessible name.
 * The caller builds the days from `kuwaitToday()` (rule 9) and the reader's locale.
 */
export interface WeekStripDay {
  iso: string;
  /** Short weekday ("أحد", "Sun"). */
  name: string;
  /** Day of month in the reader's digits. */
  number: string;
  /** Full date, the tile's accessible name ("الاثنين، ٢١ سبتمبر، اليوم"). */
  label: string;
  href: string;
  selected: boolean;
  today: boolean;
}

export interface WeekStripProps {
  days: WeekStripDay[];
  /** The strip's landmark name. */
  label: string;
  tone?: 'sky' | 'light';
  className?: string;
}

export function WeekStrip({ days, label, tone = 'sky', className }: WeekStripProps) {
  const classes = ['jr-week', tone === 'light' ? 'jr-week--light' : null, className].filter(Boolean).join(' ');
  return (
    <nav className={classes} aria-label={label}>
      {days.map((d) => (
        <Link
          key={d.iso}
          href={d.href}
          scroll={false}
          aria-label={d.label}
          aria-current={d.selected ? 'date' : undefined}
          className={[
            'jr-week__day wsf-focus',
            d.selected ? 'jr-week__day--selected' : null,
            d.today ? 'jr-week__day--today' : null,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="jr-week__name">{d.name}</span>
          <span className="jr-week__num">{d.number}</span>
        </Link>
      ))}
    </nav>
  );
}
