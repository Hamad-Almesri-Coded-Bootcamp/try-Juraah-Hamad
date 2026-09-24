'use client';

import { useRouter } from 'next/navigation';
import { IconButton } from '@/components/ui/IconButton';

/**
 * The header's sign-in at phone width: the design system's icon-only control (44×44px, its full name
 * as the accessible label), because at 390px the wordmark, the assistant and the language switch
 * fill the row. From 600px the header shows the labelled button instead (Header.tsx). A button
 * wired to a navigation, like `NavigateButton`, so it behaves the same as the labelled one.
 */
export function HeaderSignInIcon({ href, label, className }: { href: string; label: string; className?: string }) {
  const router = useRouter();
  return <IconButton icon="shield" label={label} variant="secondary" className={className} onClick={() => router.push(href)} />;
}
