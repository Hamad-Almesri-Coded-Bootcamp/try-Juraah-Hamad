import type { ReactNode } from 'react';

/**
 * ProgressRing (CR-071, a Daylight addition): a circular meter for supply left or a countdown. Its
 * number is always printed in the centre (and in words nearby), so the ring itself is decorative
 * unless a `label` names it. Progress is directional: in RTL it fills the other way (daylight.css).
 */
export interface ProgressRingProps {
  /** 0–100. */
  value: number;
  size?: number;
  stroke?: number;
  tone?: 'navy' | 'warning' | 'sky';
  /** Accessible name when the ring stands without its number in words. */
  label?: string;
  children?: ReactNode;
  className?: string;
}

export function ProgressRing({ value, size = 104, stroke = 10, tone = 'navy', label, children, className }: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, value));
  const r = size / 2 - stroke / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const classes = ['jr-ring', tone !== 'navy' ? `jr-ring--${tone}` : null, className].filter(Boolean).join(' ');
  return (
    <span
      className={classes}
      style={{ inlineSize: size, blockSize: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg className="jr-ring__svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="jr-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="jr-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={`${(circumference * pct) / 100} ${circumference}`}
        />
      </svg>
      {children != null && <span className="jr-ring__center">{children}</span>}
    </span>
  );
}
