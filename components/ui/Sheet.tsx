'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface SheetSharedProps {
  open: boolean;
  title: ReactNode;
  /** auto = bottom sheet below 834px, centred modal at and above it. Default 'auto'. */
  mode?: 'auto' | 'sheet' | 'modal';
  /** Buttons along the bottom edge. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

interface SheetNoClose extends SheetSharedProps {
  onClose?: undefined;
  closeLabel?: undefined;
}

interface SheetWithClose extends SheetSharedProps {
  onClose: () => void;
  /**
   * Accessible name of the close IconButton AND of the scrim (Sheet.md: "it is a real button labelled
   * 'Close'"). Required whenever onClose is set — the same treatment AppBar gives backLabel — since an
   * icon-only control's name must come from a prop, never a literal (UX §11), and Sheet carries no
   * `lang` to pick a built-in fallback from.
   */
  closeLabel: string;
}

/**
 * Props exactly as docs/design-system/index.d.ts's SheetProps, narrowed to a discriminated union (the
 * same treatment as AppBarProps) so closeLabel is required at the type level whenever onClose is set.
 * Recorded in README/Sheet.md and the WP2d report.
 */
export type SheetProps = SheetNoClose | SheetWithClose;

const MODE_CLASS: Record<NonNullable<SheetProps['mode']>, string> = {
  auto: 'wsf-sheet-root--auto',
  sheet: 'wsf-sheet-root--sheet',
  modal: 'wsf-sheet-root--modal',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A focused overlay (Overlays): a bottom sheet at phone width, a centred modal from tablet width up.
 * A real modal dialog — focus moves in on open, is trapped inside while open, Escape and a scrim click
 * both dismiss it (when onClose is supplied), body scroll is locked while open, and focus returns to
 * whatever opened it on close. Renders nothing while `open` is false and has no submit of its own:
 * dismissing it changes nothing.
 *
 * Positions itself against the nearest positioned ancestor (Sheet.md), so the screen that renders it
 * needs `position: relative`.
 *
 * Gap noted in the WP2d report: the brief calls for "240ms motion collapsing under reduced motion", but
 * docs/design-system/bundle.css defines no transition or animation for `.wsf-sheet-root`/`.wsf-sheet`
 * (only Button's spinner, Toggle's knob and LoadingState's skeleton pulse get motion). A ported
 * component "adds no CSS of its own" per the common brief, so no transition is added here; motion is
 * left to the bundle as shipped.
 */
export function Sheet({ open, onClose, title, mode = 'auto', footer, closeLabel, children, className }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];
    (focusables[0] ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!onClose) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const rootClasses = ['wsf-sheet-root', MODE_CLASS[mode], className].filter(Boolean).join(' ');

  return (
    <div className={rootClasses}>
      {onClose && (
        <button type="button" className="wsf-sheet__scrim" aria-label={closeLabel} tabIndex={-1} onClick={onClose} />
      )}
      <div className="wsf-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panelRef}>
        <div className="wsf-sheet__head">
          <h2 id={titleId} className="wsf-sheet__title type-h2">
            {title}
          </h2>
          {onClose && (
            <button type="button" className="wsf-btn wsf-btn--quiet wsf-iconbtn wsf-focus" aria-label={closeLabel} onClick={onClose}>
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="wsf-sheet__body">{children}</div>
        {footer && <div className="wsf-sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}
