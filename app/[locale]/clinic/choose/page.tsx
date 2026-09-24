import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession, getRoleOptions } from '@/lib/session';
import { ClinicRoleChooser } from '@/features/clinic/ClinicRoleChooser';
import { ClinicEntryFrame } from '@/features/clinic/ClinicEntryFrame';
import { copy, t } from '@/i18n';

const CLINIC_ROLES = new Set(['reviewer', 'admin']);

/**
 * X0 — the role chooser (`/[locale]/clinic/choose`), reached only after `signIn` resolves a Civil ID
 * to `multiple_roles` (in this seed, exactly د. خالد — CR-005). Defensive re-checks mirror the layout's
 * own point-2 gate: a session that is not a clinic role, or that holds only one, never sees this
 * screen (a single-role ID never reaches A1b either — ROLES.md).
 */
export default async function ClinicChoosePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  if (!session || !session.role || !CLINIC_ROLES.has(session.role)) redirect(`/${locale}/clinic`);

  const options = await getRoleOptions();
  const clinicOptions = options.filter((o) => CLINIC_ROLES.has(o.role));
  if (clinicOptions.length < 2) redirect(`/${locale}/gate`);

  return (
    <ClinicEntryFrame locale={locale} title={t(copy.clinic.x0ChooserTitle, locale)} subtitle={t(copy.clinic.x0ChooserBody, locale)}>
      <ClinicRoleChooser options={clinicOptions} locale={locale} />
    </ClinicEntryFrame>
  );
}
