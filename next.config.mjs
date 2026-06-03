/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit a self-contained server (.next/standalone) so the runner image ships only
  // runtime artifacts — no source, no devDeps (eslint/vitest/playwright). See Dockerfile.
  output: 'standalone',
  experimental: {
    // Server Actions are used pervasively; keep body limits sane for photo uploads (tuned in P10).
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
