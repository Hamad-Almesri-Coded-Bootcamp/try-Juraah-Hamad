import { AlertRow } from '@/components/ui/AlertRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert as InteractionAlertRecord } from '@/types/contracts';

const SEVERITY_RANK: Record<InteractionAlertRecord['severity'], number> = { danger: 0, warning: 1, info: 2 };

/**
 * C1's own ordering guarantee (docs/SCREENS.md C1 row: "most severe, most recent first"). `getAlerts`
 * already returns this order (lib/data/index.ts's own `SEVERITY_RANK`), but the screen re-asserts it
 * defensively rather than trusting an upstream contract it has no way to verify at render time —
 * exported so the ordering itself is unit-testable with constructed props alone, per this bundle's
 * ACCEPTANCE line: "severity ordering on C1 (test)" (docs/briefs/WP4e.md).
 */
export function sortAlerts(alerts: readonly InteractionAlertRecord[]): InteractionAlertRecord[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.createdAt.localeCompare(a.createdAt),
  );
}

export interface SafetyListProps {
  /** The patient's own alerts — from `getAlerts`, already sorted most-severe-first by the seam.
   * `reviewed` and `auto_cleared` history is included here exactly as `pending_medical_review` is;
   * `AlertRow` itself carries the quieter presentation for a checked finding (docs/SCREENS.md C1). */
  alerts: InteractionAlertRecord[];
  /** Keyed by `InteractionAlert.id`: the interacting drugs' generic names, in
   * `involvedPrescriptionIds` order — resolved by the page from `getPrescription`. A missing key
   * (a prescription the reads-layer could not resolve) renders the row with no drug names at all
   * rather than throwing. */
  drugNamesByAlertId: Record<string, string[] | undefined>;
  locale: Locale;
  /** Builds the href for a row's only affordance — opening C2. Nothing here can act on the finding. */
  hrefBuilder: (alert: InteractionAlertRecord) => string;
  /** C1's entry to C3 (Travel / photo drug check) — present whether the list is empty or not
   * (docs/SCREENS.md C1 row: "Button (drug check)"). */
  checkHref: string;
  className?: string;
}

/**
 * C1 — the Safety tab: every interaction finding as an `AlertRow` (never the full-fill
 * `InteractionAlert` treatment, which docs/SCREENS.md reserves for B2/C2 — C1's own Components row
 * lists `AlertRow†` only), most severe and most recent first, `reviewed`/`auto_cleared` history
 * included and visually quieter but present, none → a reassuring `EmptyState`. Presentational and
 * props-driven — no fetch, no mock import (the seam contract every WP4 bundle follows).
 */
export function SafetyList({ alerts, drugNamesByAlertId, locale, hrefBuilder, checkHref, className }: SafetyListProps) {
  const sorted = sortAlerts(alerts);

  return (
    <div className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      {sorted.length === 0 ? (
        <EmptyState
          icon="shield"
          title={t(copy.safety.c1EmptyTitle, locale)}
          description={t(copy.safety.c1EmptyDescription, locale)}
        />
      ) : (
        <div className="flex flex-col gap-3" data-testid="safety-list">
          {sorted.map((alert) => (
            <AlertRow
              key={alert.id}
              severity={alert.severity}
              drugs={drugNamesByAlertId[alert.id] ?? []}
              reviewStatus={alert.reviewStatus}
              href={hrefBuilder(alert)}
              lang={locale}
            />
          ))}
        </div>
      )}

      <NavigateButton href={checkHref} variant="secondary" icon="camera" lang={locale}>
        {t(copy.safety.c1CheckDrugAction, locale)}
      </NavigateButton>
    </div>
  );
}
