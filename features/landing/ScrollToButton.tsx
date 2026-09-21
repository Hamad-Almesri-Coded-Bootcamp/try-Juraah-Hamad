'use client';

import { Button, type ButtonProps } from '@/components/ui/Button';

/**
 * The hero's secondary action ("See how it works" — board: شوف كيف تشتغل), an in-page jump to the
 * solution section. Same technique as `features/shell/NavigateButton`: the real `Button`,
 * unmodified, with behaviour wired on top — never a re-styled anchor standing in for it.
 * `prefers-reduced-motion` is honoured directly (UX Principles §5): `scrollIntoView({behavior:
 * 'smooth'})` is not a CSS transition, so the global reduced-motion rule in styles/base.css does
 * not reach it on its own.
 */
export function ScrollToButton({ targetId, ...props }: { targetId: string } & Omit<ButtonProps, 'onClick'>) {
  const handleClick = () => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
  return <Button {...props} onClick={handleClick} />;
}
