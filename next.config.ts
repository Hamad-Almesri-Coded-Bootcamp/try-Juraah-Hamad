import type { NextConfig } from 'next';

// Deployment hardening (WPfinal, D-040). Applied to every response; nothing here changes a screen.
// - nosniff / Referrer-Policy: no MIME guessing, no full URL (which can carry an id) leaked cross-site.
// - frame-ancestors 'none' + X-Frame-Options: a medication app is never framed (clickjacking on
//   accept/decline, confirm/return). No page embeds an iframe, so nothing of ours is blocked.
// - Permissions-Policy: camera stays available to our own origin (PhotoInput's capture input);
//   microphone, geolocation and payment are never used.
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Phase 1 makes no network call; nothing to proxy, nothing to rewrite.
  // The clinic route is not linked anywhere, but it is gated by role like every other route
  // (see proxy.ts). Being unlisted is filing, not security.
  experimental: {
    serverActions: {
      // A phone photo of a prescription or a drug box is routinely over Next's 1 MB default, which
      // production refused with "Body exceeded 1 MB limit" on /safety/check (Vercel runtime errors,
      // 2026-09-22). 4 MB stays under Vercel's 4.5 MB function request limit, with room for the
      // multipart overhead.
      bodySizeLimit: '4mb',
    },
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      // P2-WP6 (E-46): the calendar feed exports GET alone, so Next answers every other method with
      // 405 — but that 405 carries no Allow header (RFC 9110 §15.5.6 requires one). This names it.
      { source: '/api/calendar/:token', headers: [{ key: 'Allow', value: 'GET' }] },
    ];
  },
};

export default nextConfig;
