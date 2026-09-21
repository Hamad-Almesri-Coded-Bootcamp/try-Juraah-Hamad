import { AppBar } from '@/components/ui/AppBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LanguageSwitch } from './LanguageSwitch';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import type { Locale } from '@/i18n/locale';
import type { Role } from '@/types/views';

/**
 * What every not-yet-built screen renders (WP3, "Placeholder pages"): its own AppBar — the screen
 * code and title, the language switch in the action slot (G2, on every screen including this one),
 * a back control when the screen is a pushed/nested one — over an EmptyState, so the route is
 * reachable and testable before its bundle lands. `backHref` matches the "push" pattern in
 * navigation.md; top-level tab screens (reached from the shell's own TabBar) get none, matching the
 * boards (AppBar with a title and no back control there).
 */
export function RoutePlaceholder({
  code,
  locale,
  backHref,
  role,
  subjectId,
  chrome = true,
}: {
  code: keyof typeof screenTitles;
  locale: Locale;
  backHref?: string;
  role?: Role;
  subjectId?: string;
  /** false when the surrounding layout already supplies the AppBar (signin, invitation — both
   * "no shell, only the app bar with the language switch"), so this does not render a second one. */
  chrome?: boolean;
}) {
  const title = t(screenTitles[code], locale);
  const heading = (
    <span className="flex items-center gap-2">
      <span>{code}</span>
      <span aria-hidden="true">·</span>
      <span>{title}</span>
    </span>
  );
  const body = (
    <div className="p-3">
      <EmptyState icon="inbox" title={heading} description={t(copy.shell.placeholderNotice, locale)} />
    </div>
  );

  if (!chrome) return body;

  return (
    <div className="relative flex min-h-full flex-col">
      {backHref ? (
        <AppBar
          title={title}
          backHref={backHref}
          backLabel={t(copy.vocabulary.back, locale)}
          action={<LanguageSwitch locale={locale} role={role} subjectId={subjectId} />}
        />
      ) : (
        <AppBar title={title} action={<LanguageSwitch locale={locale} role={role} subjectId={subjectId} />} />
      )}
      {body}
    </div>
  );
}
