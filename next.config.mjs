/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build a self-contained server bundle for the Docker runtime image.
  output: 'standalone',
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
