/**
 * The one piece of state L1 needs about a viewer: whether the primary "Sign in with Hawiati"
 * action should instead read as a continue-into-your-shell action, and where it goes. Computed
 * once in `cta.ts` from `getSession()` (not the data-access layer — the session module, per the
 * brief's DEPENDENCIES) and threaded down to every section that repeats the action.
 */
export type LandingCta = {
  /** Where the action goes: `/{locale}/signin` when signed out, otherwise the signed-in
   * destination (a shell home, or `/invitation` for a pending-only session). */
  href: string;
  /** true once a session exists — swaps the label from "sign in" to "continue" copy. */
  signedIn: boolean;
};
