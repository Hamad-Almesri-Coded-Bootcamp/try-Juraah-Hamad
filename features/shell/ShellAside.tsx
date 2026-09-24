'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * The shell's navigation column, told apart from the layout that renders it: a layout does not
 * re-render on an in-app navigation, so whether this screen is a tab root (dock shown on phones) or a
 * pushed screen (dock hidden below 834px, rail kept above) is read from the path here, in the
 * browser. `railOnly` is the server's answer for the first paint and for tests without a router.
 */
export function ShellAside({
  railOnly,
  tabRootPaths,
  tabRootPrefixes,
  children,
}: {
  railOnly: boolean;
  /** Paths that are a tab root exactly ("/ar/app", "/ar/app/medicines"). */
  tabRootPaths?: readonly string[];
  /** Paths under which every screen is a tab root ("/ar/app/more"). */
  tabRootPrefixes?: readonly string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const pushed =
    pathname && tabRootPaths
      ? !(tabRootPaths.includes(pathname) || (tabRootPrefixes ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`)))
      : railOnly;
  const classes = [
    pushed ? 'hidden tablet:grid' : 'flex flex-col tablet:grid',
    'tablet:order-first tablet:w-rail tablet:shrink-0 tablet:grid-rows-[auto_1fr_auto]',
  ].join(' ');
  return <aside className={classes}>{children}</aside>;
}
