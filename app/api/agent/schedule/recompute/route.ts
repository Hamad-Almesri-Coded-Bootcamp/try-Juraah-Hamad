/**
 * POST /api/agent/schedule/recompute — recompute after a reported miss, or discontinue (WP4b's engine).
 * Agent bearer, then executed as the system actor (D-025). Handler: lib/agent/handlers.ts.
 * 200 · 401 · 403 · 404 · 409 · 422 · 503 under the mock backend.
 */
import { postRecompute } from '@/lib/agent/handlers';

export async function POST(request: Request): Promise<Response> {
  return postRecompute(request);
}
