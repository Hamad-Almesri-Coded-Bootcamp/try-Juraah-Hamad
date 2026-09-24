import { Icon } from '@/components/ui/Icon';
import { Monogram } from '@/components/ui/Monogram';
import { SectorChip } from '@/components/ui/SectorChip';
import { patternLabel } from '@/features/caregiving/format';
import { copy, t } from '@/i18n';
import { localizeDrugName, localizeFacility } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { Prescription } from '@/types/contracts';
import { doseTimesLabel, rxHeadline } from './format';

/**
 * G2s's bridge (V2Clinic): the two prescriptions of a finding, side by side, joined by a dashed
 * danger line with a cross in the middle, each card naming where it came from (public or private
 * sector, the facility). This is the product's core story, so it is drawn rather than listed: two
 * doctors in two systems, one patient. On a phone the cards are compact rows joined by a vertical
 * line; once the bridge's own box is wide enough they stand side by side, joined across. A
 * composition of design-system parts (Monogram, SectorChip, the grouped card), listed in the report
 * as a Daylight composition for the owner to take into the system.
 *
 * Read-only: no control, no link. A finding about one prescription, or more than two, shows the same
 * cards without the bridge.
 */
export function PrescriptionBridge({ prescriptions, locale }: { prescriptions: Prescription[]; locale: Locale }) {
  const ends = prescriptions.map((rx) => <BridgeEnd key={rx.id} rx={rx} locale={locale} />);
  if (prescriptions.length !== 2) return <div className="flex flex-col gap-3">{ends}</div>;

  const line = 'border-dashed border-danger h-3 border-s-2 @[480px]:h-0 @[480px]:w-3 @[480px]:border-s-0 @[480px]:border-t-2';
  return (
    <div className="@container">
      <div className="flex flex-col items-stretch @[480px]:flex-row">
        {ends[0]}
        <div className="flex flex-col items-center justify-center @[480px]:flex-row">
          <span aria-hidden="true" className={line} />
          <span aria-hidden="true" className="flex size-hit items-center justify-center rounded-full border-2 border-danger bg-surface-card text-danger">
            <Icon name="close" small />
          </span>
          <span aria-hidden="true" className={line} />
          <span className="sr-only">{t(copy.clinic.g2sBridgeConnector, locale)}</span>
        </div>
        {ends[1]}
      </div>
    </div>
  );
}

function BridgeEnd({ rx, locale }: { rx: Prescription; locale: Locale }) {
  const primary = localizeDrugName(rx.drug.brandName ?? rx.drug.genericName, locale);
  const schedule = [patternLabel(rx.dosingPattern, locale), doseTimesLabel(rx.doseTimes, locale)].filter(Boolean).join(' · ');
  return (
    <article className="jr-group flex min-w-0 flex-1 items-center gap-3 p-4 @[480px]:flex-col @[480px]:gap-2 @[480px]:text-center">
      <Monogram name={primary} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 @[480px]:items-center">
        <SectorChip sector={rx.source.sector} lang={locale} />
        <h3 className="jr-display type-body-strong">{rxHeadline(rx, locale)}</h3>
        {rx.drug.brandName ? <span className="type-body-small text-ink-muted">{localizeDrugName(rx.drug.genericName, locale)}</span> : null}
        <span className="type-body-small">{localizeFacility(rx.source.facilityName, locale)}</span>
        {schedule ? <span className="jr-num type-body-small text-ink-muted">{schedule}</span> : null}
      </div>
    </article>
  );
}
