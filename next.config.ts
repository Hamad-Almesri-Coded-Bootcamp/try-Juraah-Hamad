import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Phase 1 makes no network call; nothing to proxy, nothing to rewrite.
  // The clinic route is not linked anywhere, but it is gated by role like every other route
  // (see proxy.ts). Being unlisted is filing, not security.
  // P2-WP6 (E-46): the calendar feed exports GET alone, so Next answers every other method with
  // 405 — but that 405 carries no Allow header (RFC 9110 §15.5.6 requires one). This names it.
  async headers() {
    return [{ source: '/api/calendar/:token', headers: [{ key: 'Allow', value: 'GET' }] }];
  },
};

export default nextConfig;
