/**
 * GET /api/agent/alert-recipients?patientId= — the patient's own channels plus ACTIVE caregivers
 * only (E-07). 200 · 401 · 403 · 404 · 422 · 503 under the mock backend. Handler: lib/agent/handlers.ts.
 */
import { getAlertRecipients } from '@/lib/agent/handlers';

export async function GET(request: Request): Promise<Response> {
  return getAlertRecipients(request);
}
