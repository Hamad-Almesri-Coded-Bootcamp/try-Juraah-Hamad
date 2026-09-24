import type { MetadataRoute } from 'next';
import { copy, DEFAULT_LOCALE } from '@/i18n';

// Web app manifest. iOS delivers notifications only to an installed app, so the install path has
// to be real even though Phase 1 sends no push (G12).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: copy.shell.appName[DEFAULT_LOCALE],
    short_name: copy.shell.appName[DEFAULT_LOCALE],
    description: copy.shell.appDescription[DEFAULT_LOCALE],
    start_url: `/${DEFAULT_LOCALE}`,
    display: 'standalone',
    dir: 'rtl',
    lang: DEFAULT_LOCALE,
    background_color: '#f5f7fa',
    theme_color: '#062958',
    // The day mark on navy (CR-072). The SVG for browsers that take it, PNGs for the ones that install
    // from a bitmap, and a full-bleed maskable one the launcher crops to its own shape.
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
