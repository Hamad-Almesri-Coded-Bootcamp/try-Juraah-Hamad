import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { DrugCheckFlow } from '@/features/supply/DrugCheckFlow';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';

/**
 * C3 — travel / photo drug check (`/[locale]/app/safety/check`), pushed from C1. No initial fetch
 * (idle needs none — every outcome comes from `checkDrugPhoto`, called client-side once a photo is
 * chosen), so this page mirrors `app/[locale]/app/medicines/add/page.tsx`'s (B4) own shape rather
 * than the `?view=` dev-flag pattern the list/detail screens use — there is no server read here to
 * fake a loading/error state for.
 */
export default async function DrugCheckPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  if (!session || session.role !== 'patient') notFound(); // defensive — the shell layout already gates this

  const backHref = `/${locale}/app/safety`;

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(screenTitles.C3, locale)}
        backHref={backHref}
        backLabel={t(copy.safety.c1BackLabel, locale)}
        action={<LanguageSwitch locale={locale} role="patient" subjectId={session.subjectId} />}
      />
      <DrugCheckFlow locale={locale} patientId={session.subjectId} backHref={backHref} />
    </div>
  );
}
