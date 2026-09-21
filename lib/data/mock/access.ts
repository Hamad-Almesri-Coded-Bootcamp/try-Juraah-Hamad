/**
 * Patient-scoped access enforcement (ROLES.md → "Enforcement in Phase 1", point 3; docs/briefs/
 * WP1.md §3): every patient-scoped function returns nothing unless the session is that patient, an
 * **active** caregiver linked to that patient, or a reviewer with a queue item for that patient.
 * This is the ONLY place that reads `acceptedAt` on a caregiver row is checked for — access reads
 * `status === 'active'` alone (seed invariant 1); `scripts/guards/seed-invariants.ts` scans for any
 * other use of `acceptedAt` in an access decision.
 */
import type { Session } from '@/types/views';
import type { StoreState } from './types';

export function canReadPatient(store: StoreState, session: Session | null, patientId: string): boolean {
  if (!session || !session.role) return false;
  if (session.role === 'patient') return session.subjectId === patientId;
  if (session.role === 'caregiver') {
    const cg = store.caregivers.find((c) => c.id === session.subjectId);
    return !!cg && cg.status === 'active' && cg.linkedPatientId === patientId;
  }
  if (session.role === 'reviewer') {
    const hasQueueItem =
      store.alerts.some((a) => a.patientId === patientId && a.reviewStatus === 'pending_medical_review') ||
      store.prescriptions.some((p) => p.patientId === patientId && p.needsReview && p.fieldReviewStatus !== 'confirmed');
    return hasQueueItem;
  }
  return false; // admin reads no clinical record (ROLES.md)
}
