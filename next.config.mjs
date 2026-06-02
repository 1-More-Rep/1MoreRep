/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Server Actions are used pervasively; keep body limits sane for photo uploads (tuned in P10).
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
