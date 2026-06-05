import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    name: s.brandName,
    short_name: s.brandName,
    description: 'A calm, data-confident gym tracker.',
    start_url: '/app?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: s.themeColor,
    background_color: '#f1eee6',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/badge-96.png', sizes: '96x96', type: 'image/png', purpose: 'monochrome' },
    ],
  };
}
