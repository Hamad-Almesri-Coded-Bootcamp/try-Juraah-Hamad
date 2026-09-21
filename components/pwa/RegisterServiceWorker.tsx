'use client';

import { useEffect } from 'react';

/**
 * Registers the service-worker shell (public/sw.js). Phase 1: it caches the app shell and serves
 * the offline page. It subscribes to nothing — no push subscription, no VAPID key (spec: "the
 * manifest and service-worker shell ARE in scope; the push subscription itself is Phase 2").
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* A failed registration blocks nothing: every feature works without it (G10, G12). */
    });
  }, []);
  return null;
}
