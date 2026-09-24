import { Icon } from '@/components/ui/Icon';
import { Monogram } from '@/components/ui/Monogram';
import { SectorChip } from '@/components/ui/SectorChip';
import { copy, t, type CopyEntry } from '@/i18n';
import { formatStrength } from '@/i18n/format';
import { localizeDrugName } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { Prescription } from '@/types/contracts';
import { SECTION_HEADING, SECTION_INNER, SECTION_OUTER } from './layout';

/**
 * The two prescriptions of the bridge: rx-001 and rx-002, حمد's (docs/Seed Dataset.md), one from a
 * public hospital and one from a private clinic, the pair behind the seed's one danger finding
 * (ia-001). Copied facts, not a data read (L1 makes no data-layer call). The bridge is drawn in navy,
 * never in the danger colour: it explains why the product exists, it is not a finding (L1's bounded
 * exception forbids decorative danger).
 */
const BRIDGE: ReadonlyArray<{
  brand: string;
  generic: string;
  strength: number;
  facility: CopyEntry;
  sector: Prescription['source']['sector'];
}> = [
  { brand: 'Marevan', generic: 'Warfarin', strength: 5, facility: copy.landing.problemBridgePublicFacility, sector: 'public' },
  { brand: 'Brufen', generic: 'Ibuprofen', strength: 400, facility: copy.landing.problemBridgePrivateFacility, sector: 'private' },
];

function BridgeEnd({ item, locale }: { item: (typeof BRIDGE)[number]; locale: Locale }) {
  const brand = localizeDrugName(item.brand, locale);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md bg-surface-app p-3 @[700px]:flex-col @[700px]:text-center">
      <Monogram name={brand} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 @[700px]:items-center">
        <span className="jr-display text-h2 text-navy">{brand}</span>
        <span className="type-body-small text-ink-muted">
          {localizeDrugName(item.generic, locale)} · {formatStrength(item.strength, 'mg', locale)}
        </span>
        <span className="type-body-small text-ink-muted">{t(item.facility, locale)}</span>
        <SectorChip sector={item.sector} lang={locale} className="mt-1" />
      </div>
    </div>
  );
}

/** Section (3): the problem in two parts, instruction loss and scattered records (G11 item 3), and
 * the bridge the product builds between them. */
export function ProblemSection({ locale }: { locale: Locale }) {
  const parts = [
    [copy.landing.problemRecordsTitle, copy.landing.problemRecordsBody],
    [copy.landing.problemInstructionsTitle, copy.landing.problemInstructionsBody],
  ] as const;
  const [first, second] = BRIDGE;
  return (
    <section aria-labelledby="problem-title" className={SECTION_OUTER}>
      <div className={`${SECTION_INNER} @[1000px]:grid @[1000px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @[1000px]:items-center`}>
        <div className="flex flex-col gap-4">
          <h2 id="problem-title" className={SECTION_HEADING}>
            {t(copy.landing.problemHeading, locale)}
          </h2>
          {parts.map(([title, body]) => (
            <div key={title.en} className="flex flex-col gap-1">
              <h3 className="type-h2 m-0 text-navy">{t(title, locale)}</h3>
              <p className="type-body m-0 text-ink-muted">{t(body, locale)}</p>
            </div>
          ))}
        </div>
        <figure className="jr-group m-0 flex flex-col gap-4 p-4">
          <figcaption className="type-body-small text-center text-ink-muted">{t(copy.landing.problemBridgeLabel, locale)}</figcaption>
          {/* One column at phone width, a row once there is room: the two ends and the link between. */}
          <div className="flex flex-col @[700px]:flex-row">
            {first && <BridgeEnd item={first} locale={locale} />}
            <div
              className="flex h-[calc(var(--space-6)+var(--space-4))] shrink-0 flex-col items-center @[700px]:h-auto @[700px]:w-[calc(var(--space-6)+var(--space-4))] @[700px]:flex-row"
              aria-hidden="true"
            >
              <span className="flex-1 border-s-2 border-dashed border-border-strong @[700px]:border-s-0 @[700px]:border-t-2" />
              <span className="inline-flex size-hit shrink-0 items-center justify-center rounded-full bg-navy text-on-fill">
                <Icon name="shield" small />
              </span>
              <span className="flex-1 border-s-2 border-dashed border-border-strong @[700px]:border-s-0 @[700px]:border-t-2" />
            </div>
            {second && <BridgeEnd item={second} locale={locale} />}
          </div>
          <p className="type-body-strong m-0 text-center text-navy">{t(copy.landing.problemBridgeAnswer, locale)}</p>
        </figure>
      </div>
    </section>
  );
}
