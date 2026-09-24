/**
 * POST /api/agent/patients/{patientId}/voice-turns — CR-069: one Alexa turn, for the patient's open
 * web app to follow (agent-alexa, after Alexa has answered). Not a clinical write.
 * 201 · 401 · 403 · 404 · 422 · 503 under the mock backend. Handler: lib/agent/handlers.ts.
 */
import { postVoiceTurn } from '@/lib/agent/handlers';

export async function POST(request: Request, { params }: { params: Promise<{ patientId: string }> }): Promise<Response> {
  const { patientId } = await params;
  return postVoiceTurn(request, patientId);
}
