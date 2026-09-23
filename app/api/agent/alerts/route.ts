/**
 * POST /api/agent/alerts — an interaction alert from the agents track; never `reviewed`, no reviewer
 * field. Notifies the patient and ACTIVE caregivers only; payloads carry no action (G12).
 * 201 · 401 · 403 · 422 · 503 under the mock backend. Handler: lib/agent/handlers.ts.
 */
import { postAlert } from '@/lib/agent/handlers';

export async function POST(request: Request): Promise<Response> {
  return postAlert(request);
}
