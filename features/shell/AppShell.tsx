import type { ReactNode } from 'react';
import { TabBar, type TabBarItems } from '@/components/ui/TabBar';

/**
 * The three shells' chrome (WP3 brief; navigation.md "Across breakpoints"): one `TabBar` that is
 * the bottom bar below 834px and the side rail from 834px up (its own `layout="auto"`), the
 * wordmark the wide boards draw at the top of the rail (Today834, MedicinesDesktop, ReviewerDesktop,
 * AuditLog1440), an optional rail footer (the clinic's role switch and sign-out, CR-020), the
 * content cap (`--content-max`, ~880px, from 834px up — a no-op wherever the content area is
 * already narrower, which is what makes the 1280 boards render correctly, D-009), and the
 * `position: relative` every Sheet needs from its nearest positioned ancestor (Sheet.md).
 *
 * Layout mechanics, in one place so no screen repeats them:
 * - The rail is an `<aside>` placed after `children` in markup (so the phone column layout puts it
 *   last — a bottom bar) and `tablet:order-first`, so the same element moves to the leading edge once
 *   the container becomes a row. No left/right, no duplicated markup (guard 5).
 * - From 834px the aside is a three-row grid (wordmark · TabBar · footer). A grid, not a flex
 *   column, because the bundle's `.wsf-tabs--auto` rail sets `min-block-size: 100%`, which in a flex
 *   column resolves against the whole aside and pushes the footer out; in a grid it resolves against
 *   the TabBar's own `1fr` area.
 * - `railOnly` (a pushed patient screen — B3, B4, C2, C3) hides the bottom bar below 834px, where the
 *   390 boards carry no TabBar, and keeps the rail from 834px up, where navigation.md says the side
 *   navigation is persistent (D-010). Visibility lives on the aside, never on the TabBar itself:
 *   bundle.css is unlayered and its `.wsf-tabs { display: flex }` would beat a layered utility.
 * - The wordmark and footer blocks carry the same inline-end hairline the TabBar's rail draws, so the
 *   rail reads as one continuous column.
 * - The rail is a fixed `--spacing-rail` wide (not a minimum): a long footer label (the clinic's role
 *   switch) must wrap inside it rather than widen it, because the content column's width is what the
 *   1280 boards' container queries key off (a 295px rail kept a 1280 window below the 1000px pane
 *   threshold of G2s).
 */
export function AppShell({
  items,
  value,
  label,
  wordmark,
  railOnly = false,
  railFooter,
  beforeContent,
  contentClassName = 'tablet:max-w-content',
  children,
}: {
  /** The shell's own destination set (2, 3 or 4). Absent → no bar at all, the rail column still
   * stands (the single-clinic-role case, CR-030). */
  items?: TabBarItems;
  value: string;
  label: string;
  /** Shown at the top of the rail from 834px up — the product wordmark, or the clinic's variant. */
  wordmark: ReactNode;
  railOnly?: boolean;
  /** Rendered at the bottom of the rail from 834px up (CR-020: the clinic sign-out lives there). */
  railFooter?: ReactNode;
  /** Rendered inside the scroll area above the capped content — a banner that spans the content
   * column at every width (the clinic's simulated-role banner). */
  beforeContent?: ReactNode;
  /** The cap applied to the content column. The patient and caregiver shells read at ~880px; the
   * clinic may use more width for its columns (navigation.md). */
  contentClassName?: string;
  children: ReactNode;
}) {
  const asideClasses = [
    railOnly ? 'hidden tablet:grid' : 'flex flex-col tablet:grid',
    'tablet:order-first tablet:w-rail tablet:shrink-0 tablet:grid-rows-[auto_1fr_auto]',
  ].join(' ');
  const railChrome = 'hidden border-e border-border bg-surface-card';
  const railBlock = `${railChrome} tablet:block`;

  return (
    <div className="relative flex h-dvh flex-col tablet:flex-row">
      <div className="flex-1 overflow-y-auto">
        {beforeContent}
        <div className={['mx-auto w-full', contentClassName].filter(Boolean).join(' ')}>{children}</div>
      </div>
      <aside className={asideClasses}>
        <div className={`${railBlock} px-5 pt-4 pb-2`}>
          <span className="type-body-strong text-navy">{wordmark}</span>
        </div>
        {items ? <TabBar items={items} value={value} layout="auto" label={label} /> : <div className={railBlock} />}
        {railFooter ? <div className={`${railChrome} tablet:flex flex-col gap-2 p-3`}>{railFooter}</div> : <div className={railBlock} />}
      </aside>
    </div>
  );
}
