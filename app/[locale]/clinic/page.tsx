import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { ClinicSignInForm } from '@/features/clinic/ClinicSignInForm';
import { ClinicErrorState } from '@/features/clinic/ClinicErrorState';
import { LoadingState } from '@/components/ui/LoadingState';

/**
 * X0 — clinic entry, Civil ID sign-in (`/[locale]/clinic`). See `features/clinic/ClinicSignInForm.tsx`.
 *
 * `?view=loading` / `?view=error` are the same dev-only, self-contained G7-state flag `app/[locale]/
 * app/page.tsx` (B1) established: read here from this page's own `searchParams` prop (never
 * `useSearchParams` — D-008), gated to a non-production build, carrying no seed data of its own. This
 * page has no real data fetch of its own (X0 is pure sign-in), so both states are otherwise
 * unreachable in the real flow — they exist only to demonstrate G7's four states in Playwright.
 */
export default async function ClinicEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { view: rawView } = await searchParams;
  const view = process.env.NODE_ENV === 'production' ? undefined : rawView;

  if (view === 'loading') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center p-3">
        <LoadingState variant="lines" rows={4} />
      </main>
    );
  }
  if (view === 'error') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center p-3">
        <ClinicErrorState locale={locale} backHref={`/${locale}/clinic`} />
      </main>
    );
  }

  return <ClinicSignInForm locale={locale} />;
}
