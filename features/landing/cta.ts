/**
 * Resolves L1's one piece of session-derived state (WHAT TO BUILD: "Signed-in state") as a pure
 * function of a `Session | null`, so it is unit-testable with no cookie, no request context and no
 * data-access import — `app/[locale]/page.tsx` is the only caller, and it supplies the session
 * from `getSession()` (lib/session, not lib/data; L1 makes no data-layer call).
 *
 * A `pending_invitation_only` session (F0's own gate) is signed in, but its "shell" is the
 * invitation consent screen, not one of `homePathFor`'s four roles — checked first for that
 * reason. Anything else with no resolved role is treated as signed out defensively; it should not
 * occur (`resolveCivilId` never writes a roleless, non-pending session).
 */
import { homePathFor } from '@/features/shell/tabs';
import type { Locale } from '@/i18n/locale';
import type { Session } from '@/types/views';
import type { LandingCta } from './types';

export function resolveLandingCta(session: Session | null, locale: Locale): LandingCta {
  if (session?.pendingInvitationOnly) return { href: `/${locale}/invitation`, signedIn: true };
  if (session?.role) return { href: homePathFor(session.role, locale), signedIn: true };
  return { href: `/${locale}/signin`, signedIn: false };
}
