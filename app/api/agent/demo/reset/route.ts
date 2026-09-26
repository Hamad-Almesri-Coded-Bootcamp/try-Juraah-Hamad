/**
 * POST /api/agent/demo/reset - CR-109: the owner's demo reset, for pt-03 only. Returns today's and
 * tomorrow's recorded doses to the un-recorded state and moves the rx-009 21:00 dose to 19:30; it
 * never records a status. Agent bearer only; a user session is 403. Handler: lib/agent/handlers.ts;
 * SQL: lib/data/pg/demo-reset.ts. 200 . 401 . 403 . 422 . 503 under the mock backend.
 */
import { postDemoReset } from '@/lib/agent/handlers';

export async function POST(request: Request): Promise<Response> {
  return postDemoReset(request);
}
