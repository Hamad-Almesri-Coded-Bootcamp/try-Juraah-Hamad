import type { ReactNode } from 'react';

/**
 * DayDial (CR-071, a Daylight addition): the day as a 24-hour clock face, midnight at the top. Each
 * dot is a scheduled dose, the hand is the time now (only when the day shown is today), and the
 * centre holds whatever the screen says there — on Today, the next dose.
 *
 * Rules it carries:
 * - A clock face is a real-world object, so it never mirrors in RTL (daylight.css pins `direction`).
 * - A dot's colour comes from `tone`, which the caller derives from `Dose.tracked` FIRST (rule 3):
 *   an untracked dose is always `plain`, whatever its status word says. The dot never carries
 *   meaning alone — every dose is also a row, with its time and, when tracked, its status in words.
 * - It is decorative: the list beside it is the accessible version of the same day.
 */
export type DialTone = 'plain' | 'taken_on_time' | 'taken_late' | 'missed';

export interface DialDose {
  /** Minutes since midnight, Kuwait time. */
  minutes: number;
  tone: DialTone;
}

export interface DayDialProps {
  doses: DialDose[];
  /** Minutes since midnight now; omit for a day that is not today. */
  nowMinutes?: number | null;
  /** The four hour labels at 0, 6, 12 and 18, already in the reader's digits. */
  hourLabels: readonly [string, string, string, string];
  size?: number;
  children?: ReactNode;
  className?: string;
}

const DAY = 24 * 60;

function point(c: number, r: number, minutes: number) {
  const a = (minutes / DAY) * 2 * Math.PI;
  return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
}
const f = (n: number) => Math.round(n * 10) / 10;

export function DayDial({ doses, nowMinutes, hourLabels, size = 264, children, className }: DayDialProps) {
  const c = size / 2;
  // The track sits inside a margin that holds the hour numbers outside it, so the centre stays clear.
  const r = size / 2 - 30;
  const ticks = Array.from({ length: 24 }, (_, h) => {
    const major = h % 6 === 0;
    const a = point(c, r - 13 - (major ? 7 : 3), h * 60);
    const b = point(c, r - 13, h * 60);
    return { h, major, a, b };
  });
  const labels = [0, 6, 12, 18].map((h, i) => ({ h, text: hourLabels[i]!, p: point(c, r + 21, h * 60) }));
  // One dot per distinct time; a tracked status wins over plain when two doses share a minute.
  const byMinute = new Map<number, DialTone>();
  for (const d of doses) {
    const prev = byMinute.get(d.minutes);
    if (!prev || prev === 'plain') byMinute.set(d.minutes, d.tone);
  }
  const hand = nowMinutes != null ? { a: point(c, r - 22, nowMinutes), b: point(c, r + 9, nowMinutes) } : null;

  return (
    <div className={['jr-dial', className].filter(Boolean).join(' ')} style={{ inlineSize: size, blockSize: size }}>
      <svg className="jr-dial__svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="jr-dial__track" cx={c} cy={c} r={r} strokeWidth={14} />
        {ticks.map((t) => (
          <line
            key={t.h}
            className={t.major ? 'jr-dial__tick jr-dial__tick--major' : 'jr-dial__tick'}
            x1={f(t.a.x)}
            y1={f(t.a.y)}
            x2={f(t.b.x)}
            y2={f(t.b.y)}
            strokeWidth={t.major ? 2 : 1.25}
          />
        ))}
        {labels.map((l) => (
          <text key={l.h} className="jr-dial__hour" x={f(l.p.x)} y={f(l.p.y + 5)} textAnchor="middle">
            {l.text}
          </text>
        ))}
        {[...byMinute.entries()].map(([minutes, tone]) => {
          const p = point(c, r, minutes);
          return (
            <circle
              key={minutes}
              className={tone === 'plain' ? 'jr-dial__dose' : `jr-dial__dose jr-dial__dose--${tone}`}
              cx={f(p.x)}
              cy={f(p.y)}
              r={8}
            />
          );
        })}
        {hand && (
          <>
            <line className="jr-dial__hand" x1={f(hand.a.x)} y1={f(hand.a.y)} x2={f(hand.b.x)} y2={f(hand.b.y)} />
            <circle className="jr-dial__knob" cx={f(hand.b.x)} cy={f(hand.b.y)} r={5} />
          </>
        )}
      </svg>
      {children != null && <div className="jr-dial__center">{children}</div>}
    </div>
  );
}
