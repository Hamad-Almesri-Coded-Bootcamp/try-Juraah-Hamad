'use client';

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
  return <PrescriptionCard {...props} onOpen={href ? () => router.push(href) : undefined} />;
}
