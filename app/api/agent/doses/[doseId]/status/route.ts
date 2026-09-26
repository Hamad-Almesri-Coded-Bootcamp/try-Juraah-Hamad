/**
 * POST /api/agent/doses/{doseId}/status — the ONLY path that RECORDS a dose status (G1). CR-109's
 * /api/agent/demo/reset only returns pt-03's doses to the un-recorded state.
 * Agent bearer only; a user session is 403. Handler: lib/agent/handlers.ts; SQL: lib/data/pg/agent.ts.
 * 200 · 401 · 403 · 404 · 409 (tracked:false) · 422 · 503 under the mock backend.
 */
import { postDoseStatus } from '@/lib/agent/handlers';

export async function POST(request: Request, { params }: { params: Promise<{ doseId: string }> }): Promise<Response> {
  const { doseId } = await params;
  return postDoseStatus(request, doseId);
}
