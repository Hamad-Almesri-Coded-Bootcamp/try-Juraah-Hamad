/**
 * GET /api/agent/patients/{patientId}/prescriptions — the patient's ACTIVE prescriptions, each with
 * its `needsReview` flag, for interaction screening (CR-062, TC-IX-06). Read-only.
 * 200 · 401 · 403 · 404 · 503 under the mock backend. Handler: lib/agent/handlers.ts.
 */
import { getPatientPrescriptions } from '@/lib/agent/handlers';

export async function GET(request: Request, { params }: { params: Promise<{ patientId: string }> }): Promise<Response> {
  const { patientId } = await params;
  return getPatientPrescriptions(request, patientId);
}
