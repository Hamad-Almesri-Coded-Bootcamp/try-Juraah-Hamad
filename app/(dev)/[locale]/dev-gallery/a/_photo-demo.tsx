'use client';

/**
 * Client-only companion to ./page.tsx's PhotoInput "preview"/"analysing" states, loaded with
 * `next/dynamic(..., { ssr: false })`. `PhotoInput` calls `URL.createObjectURL` on whatever `value`
 * it is given; Node's own synthetic blob registry answers that call during server rendering with a
 * different string than the browser does during hydration (`blob:nodedata:…` vs
 * `blob:http://localhost:…`), which React reports as a hydration attribute mismatch console error.
 * Real screens never hit this — `value` starts `null` there and only becomes a `File` from a
 * client-side file-input change, never during the server render. It only shows up here because the
 * gallery pre-seeds a demo photo from the very first render, so this one demo is kept out of SSR.
 */
import { PhotoInput } from '@/components/ui/PhotoInput';
import type { Locale } from '@/i18n';

function makePlaceholderPhoto(): File {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="lightslategray"/></svg>';
  return new File([svg], 'placeholder.svg', { type: 'image/svg+xml' });
}

// Evaluated once, only in the browser (this module is never imported on the server), and shared by
// every PhotoDemo instance so the preview and analysing examples show the same picture.
const photoDemo = makePlaceholderPhoto();

export default function PhotoDemo({ state, label, lang }: { state: 'preview' | 'analysing'; label: string; lang: Locale }) {
  return <PhotoInput value={photoDemo} onChange={() => {}} state={state} label={label} lang={lang} />;
}
