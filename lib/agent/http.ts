/** Small HTTP helpers shared by the agent route handlers (P2-WP7). No SQL, no copy. */
import { selectedBackend } from '@/lib/db/client';
import type { Invalid } from './validate';

export function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

/** 422 for a body the validator refused. */
export function invalid(v: Invalid): Response {
  return json(422, { error: 'invalid_body', field: v.field, reason: v.reason });
}

/** 422 naming the constraint or guard trigger the database refused with. */
export function refusedBy(constraint: string): Response {
  return json(422, { error: 'constraint_violation', constraint });
}

/** The request's JSON body, or undefined when it is not JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/**
 * Database work needs the postgres backend. Under the mock (D-020) the agent routes still refuse
 * honestly — 401/403/422 are real — and answer 503 for the work itself: the mock has no store the
 * agents track could write to, and the routes never fabricate one.
 */
export function unavailableUnderMock(): Response | null {
  return selectedBackend() === 'postgres' ? null : json(503, { error: 'unavailable' });
}
