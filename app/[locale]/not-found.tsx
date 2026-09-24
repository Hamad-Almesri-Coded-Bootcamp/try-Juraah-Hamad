import { EmptyState } from '@/components/ui/EmptyState';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { homePathFor } from '@/features/shell/tabs';
import { currentLocale } from '@/features/shell/request';
import { getSession } from '@/lib/session';
import { copy, t } from '@/i18n';

/**
 * H1 — not found. One plain sentence, one way back: the current shell's home when there is a
 * session, else the landing page (L1) — never a raw route or a blank screen.
 */
export default async function NotFound() {
  const locale = await currentLocale();
  const session = await getSession();
  const home = session?.role ? homePathFor(session.role, locale) : `/${locale}`;
  const isClinic = session?.role === 'reviewer' || session?.role === 'admin';
  const label = !session?.role ? t(copy.shell.backHome, locale) : isClinic ? t(copy.shell.backToQueue, locale) : t(copy.shell.backToToday, locale);

  return (
    // A clinic role never sees the patient assistant, here as in the clinic layout (CR-071).
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-content flex-col justify-center p-3 tablet:p-5"
      data-no-assistant={isClinic ? '' : undefined}
    >
      <EmptyState
        icon="search"
        title={t(copy.shell.notFoundTitle, locale)}
        description={t(copy.shell.notFoundBody, locale)}
        action={
          <NavigateButton href={home} variant="primary" size="lg" fullWidth lang={locale}>
            {label}
          </NavigateButton>
        }
      />
    </main>
  );
}
