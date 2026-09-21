import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Phase 1 makes no network call; nothing to proxy, nothing to rewrite.
  // The clinic route is not linked anywhere, but it is gated by role like every other route
  // (see proxy.ts). Being unlisted is filing, not security.
};

export default nextConfig;
