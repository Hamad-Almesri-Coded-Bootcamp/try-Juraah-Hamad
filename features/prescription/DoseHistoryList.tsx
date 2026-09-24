'use client';

import { useId, useState } from 'react';
import { DoseTimeline } from '@/components/ui/DoseTimeline';
import { Button } from '@/components/ui/Button';
import type { DoseStatus } from '@/components/ui/StatusPill';
import type { Locale } from '@/i18n/locale';

/** One already-formatted dose-history row — plain strings so it crosses the server/client boundary. */
export interface DoseHistoryRow {
  dateLabel: string;
  timeLabel: string;
  status: DoseStatus;
  /** Passed straight to DoseTimeline: false renders no pill (rule 3 — never chosen by `status`). */
  tracked?: boolean;
}

export interface DoseHistoryListProps {
  rows: DoseHistoryRow[];
  /** How many leading rows show before the disclosure (the 7-day window, audit M8). */
  visibleCount: number;
  /** The disclosure's label while collapsed — names the total, e.g. "Show all 20 past doses". */
  showAllLabel: string;
  showFewerLabel: string;
  lang: Locale;
}

/**
 * A `DoseTimeline` that shows its first `visibleCount` rows and puts the rest behind one real,
 * visible disclosure button (never hover, never a gesture — UX Principles §4), with `aria-expanded`
 * and `aria-controls` on it. Read-only apart from that one view control: nothing here can create or
 * change a `Dose.status` (G1), and every row's pill is still decided by its own `tracked` alone.
 */
export function DoseHistoryList({ rows, visibleCount, showAllLabel, showFewerLabel, lang }: DoseHistoryListProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const hasMore = rows.length > visibleCount;
  const shown = expanded || !hasMore ? rows : rows.slice(0, visibleCount);
  // Daylight: the day in navy, its time as a small pill. The row's status pill (tracked doses only)
  // is still DoseTimeline's own, decided by `tracked` alone.
  const items = shown.map((row) => ({
    ...row,
    dateLabel: <span className="text-navy">{row.dateLabel}</span>,
    timeLabel: (
      <span className="jr-num ms-1 inline-flex items-center rounded-full bg-navy-tint px-2 font-semibold text-navy">{row.timeLabel}</span>
    ),
  }));

  return (
    <div className="flex flex-col gap-2">
      <div id={listId} className="jr-group px-4 py-1">
        <DoseTimeline items={items} lang={lang} />
      </div>
      {hasMore && (
        <div>
          <Button variant="quiet" lang={lang} aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((v) => !v)}>
            {expanded ? showFewerLabel : showAllLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
