import { notFound } from 'next/navigation';

/**
 * H1's entry point for an unknown URL. `app/[locale]/not-found.tsx` only renders when something
 * inside the locale segment calls `notFound()`; a path that matches no route at all would otherwise
 * fall through to Next's own English default page — outside the locale layout, outside the copy
 * catalogue, with no way back. This catch-all sits below every real route (a static or dynamic
 * segment always wins over `[...rest]`) and turns "no such route" into the same H1 the spec names.
 */
export default function UnknownRoute() {
  notFound();
}
