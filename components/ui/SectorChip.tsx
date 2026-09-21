import { copy, t, type Locale } from '@/i18n';
import type { Prescription } from '@/types/contracts';

/** Prescription.source.sector, narrowed locally per index.d.ts (Sector). Never a status. */
export type Sector = Prescription['source']['sector'];

export interface SectorChipProps {
  sector: Sector;
  label?: string;
  lang?: Locale;
  className?: string;
}

/**
 * Marks a prescription as public- or private-sector in `ink-muted` inside a `border` chip — a
 * provenance label, never a status (docs/design-system/components/SectorChip.md).
 */
export function SectorChip({ sector, label, lang = 'en', className }: SectorChipProps) {
  const classes = ['wsf-chip', className].filter(Boolean).join(' ');
  const word = label ?? t(copy.vocabulary[sector], lang);
  return (
    <span className={classes}>
      <span className="type-body-small">{word}</span>
    </span>
  );
}
