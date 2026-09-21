import type * as React from 'react';
import { Card } from './Card';
import { StatusPill, type DoseStatus } from './StatusPill';
import { SectorChip, type Sector } from './SectorChip';
import { Icon } from './Icon';
import type { Locale } from '@/i18n';

/** The subset of Prescription that PrescriptionCard reads, narrowed locally per index.d.ts. */
export interface PrescriptionSummary {
  id?: string;
  drug: { genericName: string; brandName?: string; strengthMg?: number };
  source: { facilityName: string; sector: Sector };
}

const DEFAULT_STRENGTH_UNIT = ' mg';

export interface PrescriptionCardProps {
  prescription: PrescriptionSummary;
  /** The next or most recent dose. Omit and the card shows no status row. */
  dose?: { status: DoseStatus } | null;
  /** Already-formatted dose time, e.g. 'اليوم ٨:٠٠ م' or 'Today 8:00 PM'. No dates formatted here. */
  doseTimeLabel?: string;
  /** Present makes the whole card one button into the detail view and adds the mirroring chevron. */
  onOpen?: React.MouseEventHandler;
  /** Unit appended after strengthMg, exactly as written — never converted. Default ' mg'. */
  strengthUnit?: string;
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
  strengthUnit = DEFAULT_STRENGTH_UNIT,
  lang = 'en',
  className,
}: PrescriptionCardProps) {
  const { drug, source } = prescription;
  const strengthText = drug.strengthMg != null ? `${drug.strengthMg}${strengthUnit}` : null;
  const primaryName = drug.brandName ?? drug.genericName;
  const showGenericLine = Boolean(drug.brandName);

  return (
    <Card onClick={onOpen} className={['wsf-rx', className].filter(Boolean).join(' ')}>
      <span className="wsf-rx__body">
        <span className="wsf-rx__name type-body-strong">
          {primaryName}
          {strengthText ? <span> {strengthText}</span> : null}
        </span>
        {showGenericLine ? <span className="wsf-rx__generic type-body-small">{drug.genericName}</span> : null}
        <span className="wsf-rx__meta">
          <SectorChip sector={source.sector} lang={lang} />
          <span className="type-body-small">{source.facilityName}</span>
        </span>
        {dose ? (
          <span className="wsf-rx__dose">
            <StatusPill status={dose.status} lang={lang} />
            {doseTimeLabel ? <span className="type-body-small">{doseTimeLabel}</span> : null}
          </span>
        ) : null}
      </span>
      {onOpen ? <Icon name="chevron" mirror className="wsf-rx__go" /> : null}
    </Card>
  );
}
