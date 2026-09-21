import type { ReactNode } from 'react';
import { TabBar, type TabBarItems } from '@/components/ui/TabBar';

/**
 * The patient and caregiver shells' chrome (WP3 brief): the TabBar — bottom bar below 834px, side
 * rail from 834px up, both from the SAME `TabBar` instance via its own `layout="auto"` — plus the
 * ~880px desktop content cap (`--content-max`, navigation.md) and the `position: relative` every
 * Sheet needs from its nearest positioned ancestor (Sheet.md).
 *
 * The TabBar sits after `children` in markup (so column layout below 834px places it last — a
 * bottom bar) and gets `tablet:order-first` so the same element moves to the leading edge once the
 * container switches to a row (the side rail) at 834px — no left/right, no duplicated markup, no
 * physical property (guard 5).
 */
export function AppShell({
  items,
  value,
  label,
  children,
}: {
  items: TabBarItems;
  value: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-dvh flex-col tablet:flex-row">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full desktop:max-w-content">{children}</div>
      </div>
      <TabBar items={items} value={value} layout="auto" label={label} className="tablet:order-first" />
    </div>
  );
}
