import type * as React from 'react';
import { Card } from './Card';
import { StatusPill, type DoseStatus } from './StatusPill';
import { SectorChip, type Sector } from './SectorChip';
import { Icon } from './Icon';
import { Monogram } from './Monogram';
import { localizeDrugName, localizeFacility } from '@/i18n/localize';
import type { Locale } from '@/i18n';
import { formatStrength, isStrengthUnit, type StrengthUnit } from '@/i18n/format';
import { AsWritten } from './AsWritten';

/** The subset of Prescription that PrescriptionCard reads, narrowed locally per index.d.ts. */
export interface PrescriptionSummary {
  id?: string;
  /** `strengthUnit` is the prescription's own unit (the contract's field). When present it always
   * wins: printing a default unit beside `strengthMg` showed 50 mcg levothyroxine as "50 mg". */
  drug: { genericName: string; brandName?: string; strengthMg?: number; strengthUnit?: StrengthUnit };
  source: { facilityName: string; sector: Sector };
}


export interface PrescriptionCardProps {
  prescription: PrescriptionSummary;
  /** The next or most recent dose. Omit and the card shows no status row. */
  dose?: { status: DoseStatus } | null;
  /** Already-formatted dose time, e.g. 'اليوم ٨:٠٠ م' or 'Today 8:00 PM'. No dates formatted here. */
  doseTimeLabel?: string;
  /** Present makes the whole card one button into the detail view and adds the mirroring chevron. */
  onOpen?: React.MouseEventHandler;
  /** Fallback unit for a summary that carries no `drug.strengthUnit` (index.d.ts) — never converted.
   * The prescription's own unit always wins; with neither, the contract's default (mg). */
  strengthUnit?: string;
  /** Extra lines under the card's meta: the dose times, the supply remaining (Daylight, CR-071). */
  children?: React.ReactNode;
  lang?: Locale;
  className?: string;
}

/**
 * One prescription as a row: brand and generic name, the issuing facility with its sector chip, and
 * the next or most recent dose with its status pill (docs/design-system/components/PrescriptionCard.md).
 */
export function PrescriptionCard({
  prescription,
  dose,
  doseTimeLabel,
  onOpen,
  strengthUnit,
  children,
  lang = 'en',
  className,
}: PrescriptionCardProps) {
  const { drug, source } = prescription;
  const fallbackUnit = strengthUnit?.trim();
  const unit = drug.strengthUnit ?? (isStrengthUnit(fallbackUnit) ? fallbackUnit : undefined);
  // One formatter for every strength on every screen (audit M7): locale digits, one unit word.
  const strengthText = drug.strengthMg != null ? formatStrength(drug.strengthMg, unit, lang) : null;
  const generic = localizeDrugName(drug.genericName, lang);
  const primaryName = drug.brandName ? localizeDrugName(drug.brandName, lang) : generic;
  const showGenericLine = Boolean(drug.brandName);

  return (
    <Card onClick={onOpen} className={['wsf-rx', className].filter(Boolean).join(' ')}>
      <Monogram name={!drug.brandName && drug.genericName === '(unreadable)' ? '(unreadable)' : primaryName} />
      <span className="wsf-rx__body">
        <span className="wsf-rx__name type-body-strong">
          <AsWritten text={primaryName} locale={lang} />
          {strengthText ? <span> {strengthText}</span> : null}
        </span>
        {showGenericLine ? (
          <span className="wsf-rx__generic type-body-small">
            <AsWritten text={generic} locale={lang} />
          </span>
        ) : null}
        <span className="wsf-rx__meta">
          <SectorChip sector={source.sector} lang={lang} />
          <span className="type-body-small">{localizeFacility(source.facilityName, lang)}</span>
        </span>
        {dose ? (
          <span className="wsf-rx__dose">
            <StatusPill status={dose.status} lang={lang} />
            {doseTimeLabel ? <span className="type-body-small">{doseTimeLabel}</span> : null}
          </span>
        ) : null}
        {children ? <span className="wsf-rx__extra">{children}</span> : null}
      </span>
      {onOpen ? <Icon name="chevron" mirror className="wsf-rx__go" /> : null}
    </Card>
  );
}
