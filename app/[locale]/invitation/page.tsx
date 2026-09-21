import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getInvitationForConsent } from '@/lib/data';
import { InviteConsent } from '@/features/caregiving/InviteConsent';

/**
 * F0 — caregiver invitation consent. Reached two ways (SCREENS.md): a session whose only claim is
 * a pending invitation (its `subjectId` IS the invitation id — D-005), or an existing patient
 * answering the in-shell notice via `?id=` (read from `searchParams`, a server page's own props —
 * never `useSearchParams`, D-008). No other lib/data function is imported here or by
 * InviteConsent.tsx (tests/unit/caregiving/module-graph.test.ts asserts it statically).
 */
export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { id } = await searchParams;

  const session = await getSession();
  const invitationId = id ?? (session?.pendingInvitationOnly ? session.subjectId : '');
  const invitation = await getInvitationForConsent(invitationId);

  // Where "back to the home page" goes for this session (F0 pass criterion: an existing patient
  // returns to exactly where they were; a pending-only session has no shell to return to at all).
  const homeHref = session?.pendingInvitationOnly || !session ? `/${locale}` : `/${locale}/app`;

  return <InviteConsent invitation={invitation} locale={locale} homeHref={homeHref} />;
}
