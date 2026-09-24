'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PrescriptionCard, type PrescriptionCardProps } from '@/components/ui/PrescriptionCard';

/**
 * `PrescriptionCard` (docs/design-system/index.d.ts) takes `onOpen: MouseEventHandler`, not an
 * `href` — unlike `DoseRow`/`Card`, which render a real `<a>`. This wraps the same navigation
 * pattern `features/shell/NavigateButton.tsx` already uses elsewhere in the repo (`router.push`)
 * so `MedicinesList` can still honour its `hrefBuilder` contract without touching `components/ui/**`
 * (reported as a design-system prop gap in docs/backend-notes/wp4c.md, not patched here).
 */
export function PrescriptionCardLink({ href, ...props }: { href?: string } & Omit<PrescriptionCardProps, 'onOpen'>) {
  const router = useRouter();
  // Warm the detail route the way a Link would, so the tap opens it without a wait (Daylight: calm,
  // smooth navigation). Optional-called: a test double of the router may not carry it.
  useEffect(() => {
    if (href) router.prefetch?.(href);
  }, [href, router]);
  return <PrescriptionCard {...props} onOpen={href ? () => router.push(href) : undefined} />;
}
