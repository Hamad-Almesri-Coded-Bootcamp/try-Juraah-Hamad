import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession, getRoleOptions } from '@/lib/session';
import { getPatient } from '@/lib/data';
import { homePathFor } from '@/features/shell/tabs';

/**
 * A0 — the session gate (a routing state, not a designed screen): route by session exactly as
 * ROLES.md/SCREENS.md specify. `gate/loading.tsx` supplies the skeleton while this resolves, so the
 * gate is never a blank screen or a flash of the wrong shell.
 */
export default async function GatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  if (!session) redirect(`/${locale}/signin`);
  if (session.pendingInvitationOnly) redirect(`/${locale}/invitation`);

  if (session.role === 'patient') {
    const patient = await getPatient(session.subjectId);
    if (patient && !patient.onboardingCompleted) redirect(`/${locale}/app/setup`);
    redirect(`/${locale}/app`);
  }
  if (session.role) {
    redirect(homePathFor(session.role, locale));
  }

  // Defensive fallback: the mock session always carries a role once one is granted (WP1's
  // signIn shortcut resolves `multiple_roles` to a default immediately), so this only guards a
  // session shape future work might introduce without updating this file in step.
  const options = await getRoleOptions();
  if (options.length === 0) redirect(`/${locale}/signin`);
  if (options.length === 1 && options[0]) redirect(homePathFor(options[0].role, locale));
  const isClinic = options.every((o) => o.role === 'reviewer' || o.role === 'admin');
  redirect(isClinic ? `/${locale}/clinic/choose` : `/${locale}/signin/choose`);
}
