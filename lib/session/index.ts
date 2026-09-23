'use server';
/**
 * The session module — a THIN DISPATCHER (D-020), exactly like lib/data/index.ts: `mock` →
 * ./mock-impl (the Phase 1 module, moved verbatim), `postgres` → ./pg. The published interface is
 * lib/session/api.ts (unchanged); every export keeps its exact name and type.
 */
import { selectedBackend } from '@/lib/db/client';
import type { SessionApi } from './api';
import * as mock from './mock-impl';

async function impl(): Promise<SessionApi> {
  return selectedBackend() === 'postgres' ? await import('./pg') : mock;
}

export const signIn: SessionApi['signIn'] = async (...args) => (await impl()).signIn(...args);
export const getSession: SessionApi['getSession'] = async (...args) => (await impl()).getSession(...args);
export const getRoleOptions: SessionApi['getRoleOptions'] = async (...args) => (await impl()).getRoleOptions(...args);
export const chooseRole: SessionApi['chooseRole'] = async (...args) => (await impl()).chooseRole(...args);
export const signOut: SessionApi['signOut'] = async (...args) => (await impl()).signOut(...args);
