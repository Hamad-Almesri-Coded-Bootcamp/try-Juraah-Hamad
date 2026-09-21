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
    icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
