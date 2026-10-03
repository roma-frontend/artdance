/**
 * WEB APP MANIFEST — PWA (A-20): установка на главный экран.
 *
 * Единственный источник манифеста — этот файл. Статический
 * `public/manifest.webmanifest` удалён намеренно: два манифеста
 * конфликтуют, и браузер выбирает непредсказуемо. Все иконки
 * лежат в `public/media/app-icon-*.png` и генерируются
 * `scripts/generate-icons.ts`.
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ArtDance',
    short_name: 'ArtDance',
    description: 'Танцевальная платформа — занятия, преподаватели, студии и магазин',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'browser'],
    orientation: 'any',
    // eslint-disable-next-line no-restricted-syntax -- manifest требует HEX, не CSS var
    background_color: '#F7F4EF',
    // eslint-disable-next-line no-restricted-syntax -- manifest требует HEX, не CSS var
    theme_color: '#8B1A2B',
    lang: 'hy',
    dir: 'ltr',
    categories: ['lifestyle', 'sports', 'education', 'shopping'],
    prefer_related_applications: false,
    icons: [
      { src: '/media/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      {
        src: '/media/app-icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/media/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/media/app-icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Каталог занятий',
        short_name: 'Занятия',
        description: 'Найти занятия по стилю и району',
        url: '/classes',
        icons: [{ src: '/media/app-icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Преподаватели',
        short_name: 'Инструкторы',
        description: 'Преподаватели танцев в Ереване',
        url: '/instructors',
        icons: [{ src: '/media/app-icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Студии',
        short_name: 'Студии',
        description: 'Залы и площадки',
        url: '/studios',
        icons: [{ src: '/media/app-icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
