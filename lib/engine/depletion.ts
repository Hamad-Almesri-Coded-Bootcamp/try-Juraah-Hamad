/**
 * Depletion for the Postgres backend (P2-WP4b): maps a prescriptions ROW to the contract
 * `Prescription` and hands it to `computeDepletion` UNEDITED (lib/schedule/depletion.ts, which
 * reads REFERENCE_DATE itself, D-021). WP3c's getRefillOverview imports this instead of mapping
 * rows on its own, so the refill screen and the engine cannot read the same row differently.
 * Accepts either the projection in ./sql.ts or a raw driver row (see ./rows.ts). No I/O.
 */
import { computeDepletion, type Depletion } from '@/lib/schedule/depletion';
import { prescriptionFromRow, type DbRow } from './rows';

export type { Depletion };

export function depletionFor(prescriptionRow: DbRow): Depletion {
  return computeDepletion(prescriptionFromRow(prescriptionRow));
}
