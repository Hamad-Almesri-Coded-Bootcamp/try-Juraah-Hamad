'use client';

import { Icon, type IconName } from './Icon';

export interface TabBarItem {
  id: string;
  label: string;
  icon: IconName;
  /** A count that needs acting on (e.g. refills due). Omit for everything else. */
  badge?: number;
  /**
   * Renders the item as a real link instead of a button. The ONE prop addition against
   * docs/design-system/index.d.ts's TabBarProps — recorded in README/TabBar.md and the WP2d report.
   * index.d.ts's `onChange` alone cannot express navigation in the App Router, so a screen that wants
   * the tab bar to actually route supplies `href` per item; `onChange` still fires (if supplied) so the
   * consumer can keep its own `value` state in step with the route.
   */
  href?: string;
}

/** Exactly 2, 3 or 4 items — a shell's own set (G8) — refused at the type level for a 5th. */
export type TabBarItems = [TabBarItem, TabBarItem] | [TabBarItem, TabBarItem, TabBarItem] | [TabBarItem, TabBarItem, TabBarItem, TabBarItem];

export interface TabBarProps {
  items: TabBarItems;
  value: string;
  onChange?: (id: string) => void;
  /** auto = bottom bar below 834px, side rail at and above it. Default 'auto'. */
  layout?: 'auto' | 'bottom' | 'side';
  /** Accessible name of the navigation landmark. */
  label?: string;
  className?: string;
}

const LAYOUT_CLASS: Record<NonNullable<TabBarProps['layout']>, string> = {
  auto: 'wsf-tabs--auto',
  bottom: 'wsf-tabs--bottom',
  side: 'wsf-tabs--side',
};

/**
 * The product's top-level navigation (Navigation): a bottom bar below 834px, a side rail at and above
 * it. Always shows a label under every icon; the active item carries three signals — navy-tint
 * background, a navy leading-edge indicator (bundle CSS, ::after) and aria-current="page" — never
 * colour alone.
 */
export function TabBar({ items, value, onChange, layout = 'auto', label, className }: TabBarProps) {
  const classes = ['wsf-tabs', LAYOUT_CLASS[layout], className].filter(Boolean).join(' ');

  return (
    <nav className={classes} aria-label={label}>
      {items.map((item) => {
        const current = item.id === value;
        const hasBadge = typeof item.badge === 'number' && item.badge > 0;
        // The badge's assistive text is built from the consumer's own item.label — never an invented
        // word — so the control's accessible name folds the count in without duplicating the visible
        // label a second time as hidden text.
        const accessibleName = hasBadge ? `${item.label} ${item.badge}` : undefined;
        const itemClasses = 'wsf-tabs__item wsf-focus';
        const content = (
          <>
            <Icon name={item.icon} />
            <span className="type-label">{item.label}</span>
            {hasBadge && (
              <span className="wsf-tabs__badge type-caption" aria-hidden="true">
                {item.badge}
              </span>
            )}
          </>
        );

        if (item.href) {
          return (
            <a
              key={item.id}
              href={item.href}
              className={itemClasses}
              aria-current={current ? 'page' : undefined}
              aria-label={accessibleName}
              onClick={onChange ? () => onChange(item.id) : undefined}
            >
              {content}
            </a>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            className={itemClasses}
            aria-current={current ? 'page' : undefined}
            aria-label={accessibleName}
            onClick={() => onChange?.(item.id)}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
