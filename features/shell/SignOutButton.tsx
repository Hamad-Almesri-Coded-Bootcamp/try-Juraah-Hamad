'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { signOut } from '@/lib/session';
import { Button } from '@/components/ui/Button';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/**
 * Sign out exists in every shell (A3, F4, and — per CR-020 — the clinic rail). `signOut()` clears
 * the mock session, then `router.replace` to the landing page so Back does not re-enter the shell
 * (the acceptance criterion checks exactly this: replacing the current history entry rather than
 * pushing a new one).
 */
export function SignOutButton({
  locale,
  variant = 'secondary',
  fullWidth = false,
}: {
  locale: Locale;
  variant?: 'secondary' | 'quiet';
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      void (async () => {
        await signOut();
        router.replace(`/${locale}`);
      })();
    });
  };

  return (
    <Button variant={variant} lang={locale} fullWidth={fullWidth} loading={pending} onClick={handleClick}>
      {t(copy.shell.signOut, locale)}
    </Button>
  );
}
