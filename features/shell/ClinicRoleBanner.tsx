'use client';

import { usePathname } from 'next/navigation';
import { ContextBanner } from '@/components/ui/ContextBanner';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/**
 * The clinic's simulated-role banner. Which role it names follows the path in the browser: the
 * clinic layout does not re-render when the role switch moves between Review and Audit in-app, so
 * a label the layout computed would keep naming the previous role.
 */
export function ClinicRoleBanner({ locale, fallback, className }: { locale: Locale; fallback: 'review' | 'audit'; className?: string }) {
  const pathname = usePathname();
  const active = pathname ? (pathname.includes('/clinic/audit') ? 'audit' : 'review') : fallback;
  const detail = t(active === 'audit' ? copy.shell.clinicRoleAdmin : copy.shell.clinicRoleReviewer, locale);
  return <ContextBanner variant="simulated" title={t(copy.vocabulary.simulatedRole, locale)} detail={detail} icon="shield" className={className} />;
}
