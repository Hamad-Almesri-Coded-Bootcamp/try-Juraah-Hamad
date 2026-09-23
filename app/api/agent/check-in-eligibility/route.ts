/**
 * GET /api/agent/check-in-eligibility — patients with tracking on AND a connected latest link.
 * 200 · 401 · 403 · 503 under the mock backend. Handler: lib/agent/handlers.ts.
 */
import { getCheckInEligibility } from '@/lib/agent/handlers';

export async function GET(request: Request): Promise<Response> {
  return getCheckInEligibility(request);
}
