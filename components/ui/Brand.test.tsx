import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { copy, t } from '@/i18n';
import { Brand, DayMark } from './Brand';

afterEach(cleanup);

/** Hour on the 24-hour face (midnight at the top, clockwise) of a point in the 100-unit box. */
function hourOf(x: number, y: number): number {
  const deg = (Math.atan2(x - 50, 50 - y) * 180) / Math.PI;
  return (((deg + 360) % 360) / 360) * 24;
}

describe('DayMark', () => {
  it('is decorative: hidden from assistive technology, with no text of its own', () => {
    const { container } = render(<DayMark />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.textContent).toBe('');
  });

  it('puts its two doses on the 24-hour face at 08:00 and 20:00', () => {
    const { container } = render(<DayMark />);
    const hours = [...container.querySelectorAll('circle.jr-daymark__dose')].map((c) =>
      Math.round(hourOf(Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))) * 10) / 10,
    );
    expect(hours).toEqual([8, 20]);
  });

  it('keeps a gap in the track around each dose, so no background colour is needed', () => {
    const { container } = render(<DayMark />);
    const d = container.querySelector('path.jr-daymark__track')!.getAttribute('d')!;
    const ends = [...d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)(?=[AM]|$)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const doses = [...container.querySelectorAll('circle.jr-daymark__dose')].map((c) => [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]);
    expect(ends).toHaveLength(4);
    for (const [dx, dy] of doses) {
      const nearest = Math.min(...ends.map(([x, y]) => Math.hypot(x! - dx!, y! - dy!)));
      expect(nearest).toBeGreaterThanOrEqual(11.9);
      expect(nearest).toBeLessThan(12.1);
    }
  });

  it('takes its colours from the theme, never inline and never danger', () => {
    const { container } = render(<DayMark />);
    const painted = [...container.querySelectorAll('path, circle')];
    for (const el of painted) {
      expect(el.getAttribute('stroke')).toBeNull();
      expect(['none', null]).toContain(el.getAttribute('fill'));
      expect(el.getAttribute('class')).not.toMatch(/danger|warning|success/);
    }
  });

  it('never mirrors: no transform on the drawing', () => {
    const { container } = render(<div dir="rtl"><DayMark /></div>);
    expect(container.querySelector('[transform]')).toBeNull();
  });
});

describe('Brand', () => {
  it('prints the name from the catalogue as text, once', () => {
    render(<Brand name={t(copy.shell.appName, 'ar')} className="jr-wordmark" />);
    expect(screen.getAllByText('جرعة')).toHaveLength(1);
  });

  it('puts the mark before the name, so it sits at the start in both directions', () => {
    const { container } = render(<Brand name={t(copy.shell.appName, 'en')} />);
    const lockup = container.firstElementChild!;
    expect(lockup.className).toContain('jr-brand');
    expect(lockup.firstElementChild!.tagName.toLowerCase()).toBe('svg');
    expect(lockup.lastElementChild!.textContent).toBe('Jur’ah');
  });

  it('is not a heading', () => {
    render(<Brand name={t(copy.shell.appName, 'en')} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
