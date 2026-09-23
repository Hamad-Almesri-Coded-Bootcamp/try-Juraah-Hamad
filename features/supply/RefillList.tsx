'use client';

/**
 * D1 — refill request (`/[locale]/app/more/refill`, also pushed from B3 with `?rx=`). Per active
 * prescription: remaining/total, a depletion estimate only when `daysRemaining !== null` (no
 * `dispensing` → no estimate, never an invented number — rule 9 / `DepletionMeter.md`), a
 * `SectorChip` and a request action → a confirm `Sheet` naming the routing destination derived from
 * that prescription's own `routedTo` (already computed server-side from `source.sector` —
 * lib/data/index.ts's `getRefillOverview`, never re-derived here). A **my requests** section lists
 * every `RefillRequest` via `MenuRow`.
 *
 * "Already requested" (docs/backend-notes/wp4f.md §7): only a `'requested'` row suppresses the
 * button and shows the InlineNotice — `'approved'`/`'denied'` are a resolved past cycle (حمد's own
 * `rx-001` carries an `'approved'` request from before its most recent dispensing) and a new request
 * stays offered. `rx-003`'s seeded `'requested'` row renders this way from first load, with no extra
 * client state needed to reach that.
 *
 * Presentational plus its own two writes (`requestRefill`, both a supply write, never `Dose.status`
 * — G1): the page fetches `getRefillOverview`/`getRefillRequests` and passes the results in; this
 * component calls only the published `@/lib/data` functions, never a fetch or a mock import.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { SectorChip } from '@/components/ui/SectorChip';
import { DepletionMeter } from '@/components/ui/DepletionMeter';
import { DetailRow } from '@/components/ui/DetailRow';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { MenuRow } from '@/components/ui/MenuRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { requestRefill } from '@/lib/data';
import { alreadyRequestedBody, destinationLabel, pendingRequestFor, requestLineDescription, requestStatusLabel, sectorFromRoutedTo } from './format';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { RefillLine, RefillRequest } from '@/types/views';

export interface RefillListProps {
  overview: RefillLine[];
  requests: RefillRequest[];
  patientId: string;
  locale: Locale;
  /** The `?rx=` prescription from B3's own refill Button (DEPENDENCIES) — scrolled to and
   * highlighted; absent (or not among today's active lines) means the plain list. */
  highlightPrescriptionId?: string;
  className?: string;
}

export function RefillList({ overview, requests, patientId, locale, highlightPrescriptionId, className }: RefillListProps) {
  const router = useRouter();
  const [confirmTarget, setConfirmTarget] = useState<RefillLine | null>(null);
  const [pending, startTransition] = useTransition();
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightPrescriptionId) highlightRef.current?.scrollIntoView?.({ block: 'center' });
  }, [highlightPrescriptionId]);

  function confirmRequest() {
    if (!confirmTarget) return;
    const prescriptionId = confirmTarget.prescriptionId;
    startTransition(() => {
      void (async () => {
        await requestRefill(patientId, prescriptionId);
        setConfirmTarget(null);
        router.refresh();
      })();
    });
  }

  return (
    <div className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      {overview.length === 0 ? (
        <EmptyState icon="capsule" title={t(copy.supply.d1EmptyTitle, locale)} description={t(copy.supply.d1EmptyBody, locale)} />
      ) : (
        <div className="flex flex-col gap-4" data-testid="refill-list">
          {overview.map((line) => {
            const pendingRequest = pendingRequestFor(requests, line.prescriptionId);
            const highlighted = line.prescriptionId === highlightPrescriptionId;
            return (
              <div key={line.prescriptionId} ref={highlighted ? highlightRef : undefined} className={highlighted ? 'rounded-md bg-navy-tint p-1' : undefined}>
                <Card className="flex flex-col gap-3" data-testid="refill-line">
                  <div className="flex flex-col gap-1">
                    <span className="type-body-strong">
                      {line.genericName}
                      {line.brandName && <span className="type-body-small"> {line.brandName}</span>}
                    </span>
                    <SectorChip sector={sectorFromRoutedTo(line.routedTo)} lang={locale} />
                  </div>

                  {line.daysRemaining !== null && line.remaining !== null && line.total !== null && (
                    <DepletionMeter remaining={line.remaining} total={line.total} daysRemaining={line.daysRemaining} lang={locale} />
                  )}

                  {pendingRequest ? (
                    <InlineNotice tone="info" title={t(copy.supply.d1AlreadyRequestedTitle, locale)}>
                      {alreadyRequestedBody(pendingRequest.routedTo, locale)}
                    </InlineNotice>
                  ) : (
                    // Secondary, not primary (UX §2, audit M19): one per active prescription would put
                    // three primaries on the screen. The confirm Sheet's "Send the request" is the one.
                    <Button variant="secondary" fullWidth lang={locale} onClick={() => setConfirmTarget(line)}>
                      {t(copy.supply.d1RequestButtonLabel, locale)}
                    </Button>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="type-h2">{t(copy.supply.d1MyRequestsHeading, locale)}</h2>
      {requests.length === 0 ? (
        <p className="type-body-small">{t(copy.supply.d1RequestsEmpty, locale)}</p>
      ) : (
        <div className="flex flex-col" data-testid="refill-requests">
          {requests.map((request) => {
            const line = overview.find((l) => l.prescriptionId === request.prescriptionId);
            const label = line ? (line.brandName ? `${line.genericName} ${line.brandName}` : line.genericName) : t(copy.supply.d1UnknownPrescriptionLabel, locale);
            return (
              <MenuRow
                key={request.id}
                label={label}
                description={requestLineDescription(request, locale)}
                value={requestStatusLabel(request.status, locale)}
              />
            );
          })}
        </div>
      )}

      <Sheet
        open={!!confirmTarget}
        title={t(copy.supply.d1ConfirmSheetTitle, locale)}
        onClose={() => setConfirmTarget(null)}
        closeLabel={t(copy.vocabulary.close, locale)}
        footer={
          <>
            <Button variant="primary" fullWidth lang={locale} loading={pending} onClick={confirmRequest}>
              {t(copy.supply.d1ConfirmSendButton, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setConfirmTarget(null)} disabled={pending}>
              {t(copy.supply.d1ConfirmCancelButton, locale)}
            </Button>
          </>
        }
      >
        {confirmTarget && (
          <div className="flex flex-col gap-2">
            <DetailRow
              label={t(copy.supply.d1ConfirmDrugLabel, locale)}
              value={confirmTarget.brandName ? `${confirmTarget.genericName} ${confirmTarget.brandName}` : confirmTarget.genericName}
              lang={locale}
            />
            <DetailRow label={t(copy.supply.d1ConfirmDestinationLabel, locale)} value={destinationLabel(confirmTarget.routedTo, locale)} lang={locale} />
          </div>
        )}
      </Sheet>
    </div>
  );
}
