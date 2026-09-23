/**
 * GET /api/agent/patients/{patientId}/doses?date=YYYY-MM-DD — the patient's TRACKED doses of one
 * Kuwait calendar date, for the check-in message and for attributing a reply (CR-062). Read-only.
 * 200 · 401 · 403 · 404 · 422 (date) · 503 under the mock backend. Handler: lib/agent/handlers.ts.
 */
import { getPatientDoses } from '@/lib/agent/handlers';

export async function GET(request: Request, { params }: { params: Promise<{ patientId: string }> }): Promise<Response> {
  const { patientId } = await params;
  return getPatientDoses(request, patientId);
}
