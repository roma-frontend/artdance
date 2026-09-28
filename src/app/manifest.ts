/**
 * WEB APP MANIFEST — PWA (A-20): установка на главный экран.
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ArtDance',
    short_name: 'ArtDance',
    description: 'Танцевальная платформа — записи, занятия, магазины',
    start_url: '/',
    display: 'standalone',
    // eslint-disable-next-line no-restricted-syntax -- manifest требует HEX, не CSS var
    background_color: '#F7F4EF',
    // eslint-disable-next-line no-restricted-syntax -- manifest требует HEX, не CSS var
    theme_color: '#8B1A2B',
    lang: 'hy',
    icons: [
      { src: '/media/app-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/media/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' as never },
    ],
  };
}
