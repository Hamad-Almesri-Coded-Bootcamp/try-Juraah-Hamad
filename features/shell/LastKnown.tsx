import { ContextBanner } from '@/components/ui/ContextBanner';
import { RefreshButton } from './RefreshButton';
import { formatAsOf } from './format';
import { copy, t } from '@/i18n';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/locale';

/**
 * H3's failed-refresh pattern (offline page and any list screen that falls back to
 * `readLastKnownSnapshot`): the last known data, the ContextBanner `lastKnown` variant with its
 * "as of" line, and a refresh Button — never an empty screen (UX Principles §6).
 */
export function LastKnown({ asOf, locale, children }: { asOf: string; locale: Locale; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <ContextBanner
        variant="lastKnown"
        title={t(copy.shell.lastKnownTitle, locale)}
        detail={`${t(copy.vocabulary.asOf, locale)} ${formatAsOf(asOf, locale)}`}
        icon="refresh"
      />
      {children}
      <RefreshButton locale={locale} label={t(copy.shell.refresh, locale)} />
    </div>
  );
}
