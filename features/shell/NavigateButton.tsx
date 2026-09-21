'use client';

import { useRouter } from 'next/navigation';
import { Button, type ButtonProps } from '@/components/ui/Button';

/**
 * The real `Button` component, wired to a real navigation instead of an inline handler — used
 * wherever the system pages (H1/H2/H3) offer "the way back" as a Button rather than a link (their
 * boards draw it that way: a full-width primary/secondary Button, not an anchor). No restyling: the
 * same component, the same classes, only `onClick` added.
 */
export function NavigateButton({ href, ...props }: { href: string } & Omit<ButtonProps, 'onClick'>) {
  const router = useRouter();
  return <Button {...props} onClick={() => router.push(href)} />;
}
