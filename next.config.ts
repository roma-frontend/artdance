import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { buildCacheHeaderRules } from './src/config/cache';
import { imageQuality, imageWidths } from './src/config/media';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProduction = process.env.NEXT_PUBLIC_APP_ENV === 'production';

/**
 * Разделение ответственности зафиксировано намеренно:
 *   • security-заголовки и CSP → `src/proxy.ts`;
 *   • Cache-Control → этот файл.
 * Заголовки, заданные в двух местах, конфликтуют, и отладка превращается в
 * угадывание, какой слой победил.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  typescript: {
    // Сборка не должна проходить при ошибках типов — это часть контроля качества.
    ignoreBuildErrors: false,
  },

  images: {
    /**
     * Ширины берутся из media-конфига, чтобы `sizes` и генерируемые варианты
     * не разошлись между собой.
     */
    deviceSizes: [...imageWidths],
    imageSizes: [48, 96, 120, 160, 240],
    /**
     * Разрешённые значения `quality` — из тех же presets, что использует `Media`.
     *
     * Next 16 обслуживает только перечисленные здесь значения: любое другое
     * молча заменяется на 75 с предупреждением в консоли. Список по умолчанию —
     * `[75]`, а наши presets просят 70, 78, 82 и 88, то есть без этой строки
     * editorial-кадры отдавались хуже, чем задумано, а thumbnail — тяжелее.
     * Перечислять руками нельзя: разойдётся с `imageQuality` при первой правке.
     */
    qualities: [...new Set(Object.values(imageQuality))].sort((a, b) => a - b),
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    /**
     * Никаких wildcard в remotePatterns: `hostname: '**'` превращает приложение
     * в открытый прокси оптимизации изображений для чужих хостов и открывает
     * SSRF через `next/image`. Хост R2 задаётся точно.
     */
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
    /** SVG из внешних источников — вектор XSS. Иконки поставляются как компоненты. */
    dangerouslyAllowSVG: false,
  },

  /** Барели библиотек иконок и UI тянут весь пакет: включаем tree-shaking. */
  experimental: {
    optimizePackageImports: ['lucide-react', 'radix-ui', 'date-fns'],
  },

  /** Типизированные роуты включим после стабилизации набора страниц. */
  typedRoutes: false,

  compiler: {
    /** `console.error`/`warn` остаются: они уходят в Sentry и нужны в проде. */
    removeConsole: isProduction ? { exclude: ['error', 'warn'] } : false,
  },

  /**
   * Source maps в проде: без них Sentry не разворачивает стеки, а Lighthouse
   * снижает оценку. `.map` скачиваются только при открытых DevTools, поэтому
   * обычные пользователи ничего не платят за это.
   */
  productionBrowserSourceMaps: true,

  serverExternalPackages: ['@prisma/adapter-pg'],

  async headers() {
    return buildCacheHeaderRules();
  },
};

export default withNextIntl(nextConfig);
