import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MenuRow } from './MenuRow';

afterEach(cleanup);

describe('MenuRow', () => {
  it('renders a plain row when neither href nor onClick is set', () => {
    render(<MenuRow label="Help" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('renders a link destination', () => {
    render(<MenuRow label="Refill" href="/refill" />);
    expect(screen.getByRole('link', { name: /Refill/ })).toHaveAttribute('href', '/refill');
  });

  it('renders a settings row with a value', () => {
    render(<MenuRow label="Calendar sync" value="On" onClick={vi.fn()} />);
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('renders a relationship state in ink-muted with no badge, dot or alert icon', () => {
    render(<MenuRow label="Nasser" value="Awaiting acceptance" tone="relationship" />);
    const value = screen.getByText('Awaiting acceptance');
    expect(value).toHaveAttribute('data-tone', 'relationship');
    expect(value.querySelector('svg')).toBeNull();
    expect(value.closest('.jr-menu-row')?.querySelector('[class*="badge"], [class*="dot"]')).toBeNull();
  });

  it('holds a trailing control (a Toggle slot) instead of becoming interactive itself', () => {
    const onClick = vi.fn();
    render(
      <MenuRow label="Dose reminders" trailing={<input type="checkbox" aria-label="Dose reminders" defaultChecked />} onClick={onClick} />
    );
    // trailing wins: the row itself is not a nested button/link around the checkbox
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('a row holding a trailing control is marked, so only it wraps at phone width (audit M13)', () => {
    render(<MenuRow label="عبدالله" description="ابني" value="نشِط · قبِل ٣ سبتمبر ٢٠٢٦" trailing={<button type="button">سحب الصلاحية</button>} />);
    const row = screen.getByText('عبدالله').closest('.jr-menu-row')!;
    expect(row).toHaveClass('jr-menu-row--trailing');
    const parts = [...row.children].map((el) => el.className);
    expect(parts).toEqual(['jr-menu-row__text', 'jr-menu-row__value type-body-small', 'jr-menu-row__trailing']);
  });

  it('a destination or value row carries no trailing marker — its layout is unchanged (More, profile)', () => {
    render(<MenuRow label="Browser notifications" value="Blocked by the browser" href="/en/app/more/notifications" />);
    expect(screen.getByRole('link')).not.toHaveClass('jr-menu-row--trailing');
  });

  it('fires onClick when set and no trailing is present', () => {
    const onClick = vi.fn();
    render(<MenuRow label="Settings" onClick={onClick} />);
    screen.getByRole('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

/**
 * Audit M13 (2026-09-23): at 390px in English the F1 rows crushed the label to one word per line,
 * the status overlapped it and "Revoke access" ran off the viewport, because the value and the
 * trailing control were both `flex: none` beside a label allowed to shrink to zero. jsdom loads no
 * stylesheet and computes no layout, so this pins the CSS contract that fixes it; the visual proof at
 * 390 / 834 / 1440 is the e2e matrix's job.
 */
describe('MenuRow.css — the phone-width layout contract (audit M13)', () => {
  const css = readFileSync(join(process.cwd(), 'components/ui/styles/MenuRow.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  function block(selector: string, source = css): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`(^|[\\s,}])${escaped}\\s*\\{([^}]*)\\}`));
    if (!match) throw new Error(`no rule for ${selector}`);
    return match[2]!;
  }

  it('a row with a trailing control wraps instead of crushing its label; other rows keep their one-line layout', () => {
    expect(block('.jr-menu-row--trailing')).toMatch(/flex-wrap:\s*wrap/);
    expect(block('.jr-menu-row')).not.toMatch(/flex-wrap/);
  });

  it('in such a row the label keeps a floor (never one word per line) and the value may shrink and drop beneath it', () => {
    expect(block('.jr-menu-row--trailing .jr-menu-row__text')).toMatch(/flex:\s*1 1 50%/);
    const value = block('.jr-menu-row--trailing .jr-menu-row__value');
    expect(value).toMatch(/flex:\s*0 1 auto/);
    expect(value).toMatch(/min-inline-size:\s*0/);
  });

  it('at phone width the trailing control takes its own line, at the inline end; from tablet up it sits inline again', () => {
    const trailing = block('.jr-menu-row__trailing');
    expect(trailing).toMatch(/flex:\s*1 0 100%/);
    expect(trailing).toMatch(/justify-content:\s*flex-end/);
    expect(trailing).toMatch(/margin-inline-start:\s*auto/);
    const tablet = css.match(/@media \(min-width: 834px\)\s*\{([\s\S]*?)\n\}/);
    expect(tablet, 'a tablet-up media block').not.toBeNull();
    expect(block('.jr-menu-row__trailing', tablet![1]!)).toMatch(/flex:\s*none/);
  });

  it('logical properties only — no physical left/right anywhere in the file (guard 5, restated)', () => {
    expect(css).not.toMatch(/(^|[^-\w])(left|right)\s*:|-(left|right)\b/);
  });
});
