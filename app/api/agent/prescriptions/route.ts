/**
 * POST /api/agent/prescriptions — the extraction write path; `prescription.source` is required
 * (CR-042). 201 · 401 · 403 · 422 (body, or the constraint named) · 503 under the mock backend.
 * Handler: lib/agent/handlers.ts.
 */
import { postPrescription } from '@/lib/agent/handlers';

export async function POST(request: Request): Promise<Response> {
  return postPrescription(request);
}
