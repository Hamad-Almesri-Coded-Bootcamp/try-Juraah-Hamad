/**
 * The session module's published interface (docs/SCREENS.md appendix → "Session module (5)").
 * Exactly 5 methods, one per line, `  name(` — parsed by scripts/notes-check.ts and guard 4.
 */
import type { RoleOption, Session, SignInOutcome } from '@/types/views';

export interface SessionApi {
  signIn(civilId: string): Promise<SignInOutcome>;
  getSession(): Promise<Session | null>;
  getRoleOptions(): Promise<RoleOption[]>;
  chooseRole(option: RoleOption): Promise<Session>;
  signOut(): Promise<void>;
}
