'use client';

/**
 * D1 — refill request (`/[locale]/app/more/refill`, also pushed from B3 with `?rx=`), Daylight
 * (CR-071). One card per active prescription: the medicine (brand first, then generic) with its
 * facility and sector on one line, supply left as a ring with the days in the middle only when
 * `daysRemaining !== null` (no `dispensing` → a plain sentence, never an invented number —
 * `DepletionMeter.md`), and a request action → a confirm `Sheet` naming the routing destination
 * derived from that prescription's own `routedTo` (already computed server-side from
 * `source.sector` — lib/data/index.ts's `getRefillOverview`, never re-derived here). **My requests**
 * lists every `RefillRequest` in one grouped card, each with its status as a small chip.
 *
 * "Already requested" (docs/backend-notes/wp4f.md §7): only a `'requested'` row suppresses the
 * button and shows the requested line inside the card — `'approved'`/`'denied'` are a resolved past
 * cycle and a new request stays offered.
 *
 * Presentational plus its own write (`requestRefill`, a supply write, never `Dose.status` — G1): the
 * page fetches `getRefillOverview`/`getRefillRequests`/`getPrescriptions` and passes the results in;
 * this component calls only the published `@/lib/data` functions, never a fetch or a mock import.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { DetailRow } from '@/components/ui/DetailRow';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Monogram } from '@/components/ui/Monogram';
import { Sheet } from '@/components/ui/Sheet';
import { MenuRow } from '@/components/ui/MenuRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { medicineNames } from '@/features/prescription/format';
import { requestRefill } from '@/lib/data';
import { localizeFacility } from '@/i18n/localize';
import { alreadyRequestedBody, destinationLabel, pendingRequestFor, requestLineDescription, requestStatusLabel, sectorFromRoutedTo } from './format';
import { SupplyRing, isLowSupply, supplyCountLine } from './SupplyRing';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Prescription } from '@/types/contracts';
import type { RefillLine, RefillRequest } from '@/types/views';

export interface RefillListProps {
  overview: RefillLine[];
  requests: RefillRequest[];
  patientId: string;
  locale: Locale;
  /** The patient's prescriptions, for each card's facility and for naming a request whose
   * prescription is no longer active. Optional: without it a card shows its sector alone. */
  prescriptions?: Pick<Prescription, 'id' | 'drug' | 'source'>[];
  /** The `?rx=` prescription from B3's own refill Button (DEPENDENCIES) — scrolled to and
   * highlighted; absent (or not among today's active lines) means the plain list. */
  highlightPrescriptionId?: string;
  className?: string;
}

/** The request's status as a small chip, in words (never the raw contract value): pending in the
 * warning tone, approved in the success tone, declined muted. Never a dose-status pill. */
function RequestStatusChip({ status, locale }: { status: RefillRequest['status']; locale: Locale }) {
  const tone = status === 'approved' ? 'text-success border-success' : status === 'denied' ? 'text-ink-muted border-border' : 'text-warning border-warning';
  return (
    <span className={`type-body-small inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 font-semibold ${tone}`}>
      {requestStatusLabel(status, locale)}
    </span>
  );
}

export function RefillList({ overview, requests, patientId, locale, prescriptions = [], highlightPrescriptionId, className }: RefillListProps) {
  const router = useRouter();
  const [confirmTarget, setConfirmTarget] = useState<RefillLine | null>(null);
  const [pending, startTransition] = useTransition();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const rxById = new Map(prescriptions.map((p) => [p.id, p]));

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

  /** "ماريفان · وارفارين" — brand first, both in the reader's language. */
  const nameOf = (drug: { genericName?: string; brandName?: string }) => {
    const { primary, generic } = medicineNames(drug, locale);
    return generic ? `${primary} · ${generic}` : primary;
  };

  return (
    <div className={['@container flex flex-col gap-5', className].filter(Boolean).join(' ')}>
      {overview.length === 0 ? (
        <EmptyState icon="capsule" title={t(copy.supply.d1EmptyTitle, locale)} description={t(copy.supply.d1EmptyBody, locale)} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 @[720px]:grid-cols-2" data-testid="refill-list">
          {overview.map((line) => {
            const pendingRequest = pendingRequestFor(requests, line.prescriptionId);
            const highlighted = line.prescriptionId === highlightPrescriptionId;
            const { primary, generic } = medicineNames(line, locale);
            const facility = rxById.get(line.prescriptionId)?.source.facilityName;
            const provenance = [facility ? localizeFacility(facility, locale) : null, t(copy.vocabulary[sectorFromRoutedTo(line.routedTo)], locale)]
              .filter(Boolean)
              .join(' · ');
            const hasSupply = line.daysRemaining !== null && line.remaining !== null && line.total !== null;
            return (
              <div
                key={line.prescriptionId}
                ref={highlighted ? highlightRef : undefined}
                className={highlighted ? 'rounded-lg ring-2 ring-navy ring-offset-2 ring-offset-surface-app' : undefined}
              >
                <Card className="flex flex-col gap-4" data-testid="refill-line">
                  <div className="flex items-center gap-3">
                    <Monogram name={primary} />
                    <div className="flex min-w-0 flex-col">
                      <span className="jr-display type-body-strong text-navy">{primary}</span>
                      {generic ? <span className="type-body-small text-ink-muted">{generic}</span> : null}
                      <span className="type-body-small text-ink-muted">{provenance}</span>
                    </div>
                  </div>

                  {hasSupply ? (
                    <div className="flex items-center gap-4">
                      <SupplyRing remaining={line.remaining!} total={line.total!} daysRemaining={line.daysRemaining} locale={locale} size={80} />
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="type-body-strong text-navy">{supplyCountLine(line.remaining!, line.total!, locale)}</span>
                        {isLowSupply(line.daysRemaining) ? (
                          <span className="type-body-small flex items-center gap-1 font-semibold text-warning">
                            <Icon name="warning" small />
                            {t(copy.vocabulary.lowSupply, locale)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="type-body-small m-0 text-ink-muted">{t(copy.supply.supplyNoEstimate, locale)}</p>
                  )}

                  {pendingRequest ? (
                    <p role="status" className="type-body-small m-0 flex items-start gap-2 border-t border-border pt-3 text-navy">
                      <Icon name="check" small className="mt-1 flex-none text-success" />
                      <span className="flex flex-col">
                        <strong className="font-semibold">{t(copy.supply.d1AlreadyRequestedTitle, locale)}</strong>
                        <span className="text-ink-muted">{alreadyRequestedBody(pendingRequest.routedTo, locale)}</span>
                      </span>
                    </p>
                  ) : (
                    // Secondary, not primary (UX §2, audit M19): one per active prescription would put
                    // three primaries on the screen. The confirm Sheet's "Send the request" is the one.
                    <Button variant="secondary" icon="refresh" fullWidth lang={locale} onClick={() => setConfirmTarget(line)}>
                      {t(copy.supply.d1RequestButtonLabel, locale)}
                    </Button>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <section className="flex flex-col gap-2" aria-label={t(copy.supply.d1MyRequestsHeading, locale)}>
        <h2 className="jr-group-title">{t(copy.supply.d1MyRequestsHeading, locale)}</h2>
        {requests.length === 0 ? (
          <p className="type-body-small m-0 px-1 text-ink-muted">{t(copy.supply.d1RequestsEmpty, locale)}</p>
        ) : (
          <div className="jr-group" data-testid="refill-requests">
            {requests.map((request) => {
              const line = overview.find((l) => l.prescriptionId === request.prescriptionId);
              const rx = rxById.get(request.prescriptionId);
              const label = line ? nameOf(line) : rx ? nameOf(rx.drug) : t(copy.supply.d1UnknownPrescriptionLabel, locale);
              return (
                <MenuRow
                  key={request.id}
                  icon="refresh"
                  label={label}
                  description={requestLineDescription(request, locale)}
                  value={<RequestStatusChip status={request.status} locale={locale} />}
                />
              );
            })}
          </div>
        )}
      </section>

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
          <div className="flex flex-col">
            <DetailRow label={t(copy.supply.d1ConfirmDrugLabel, locale)} value={nameOf(confirmTarget)} lang={locale} />
            <DetailRow label={t(copy.supply.d1ConfirmDestinationLabel, locale)} value={destinationLabel(confirmTarget.routedTo, locale)} lang={locale} />
          </div>
        )}
      </Sheet>
    </div>
  );
}
