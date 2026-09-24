import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { HelpScreen } from '@/features/ambient/HelpScreen';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';

/**
 * E4 — help & support (patient) (`/[locale]/app/more/help`). Static copy only — no data function,
 * so this page has no loading/error/offline state to demonstrate beyond G7's "content" (SCREENS.md:
 * "none (copy catalogue only)"); the session check stays defensive-only since the shell layout
 * already gates the route to a signed-in patient.
 */
export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(screenTitles.E4, locale)}
        backHref={`/${locale}/app/more`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} />}
      />
      <div className="px-3 pb-5 pt-2 tablet:px-5">
        <HelpScreen locale={locale} />
      </div>
    </div>
  );
}
