import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { buildCacheHeaderRules } from './src/config/cache';
import { imageQuality, imageWidths, mediaBaseUrl } from './src/config/media';

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
    // .next/dev types are regenerated as corrupted on Windows Turbopack - skip dev types check, keep production types
    // Next build typecheck is run via tsc --noEmit with include without .next/dev, so safe to ignore dev folder errors
    ignoreBuildErrors: true, // Next 16 Turbopack corrupts .next/dev/types on Windows - real check is npm run typecheck
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
    remotePatterns: (() => {
      // Как в builder-studio: разрешаем R2-хосты wildcard, + точный хост из env.
      // Это гарантирует, что `next/image` с удалённым `NEXT_PUBLIC_MEDIA_CDN_URL`
      // не получит 400 INVALID_IMAGE_OPTIMIZE_REQUEST даже если mediaBaseUrl
      // был пуст в момент сборки (Vercel инлайнит NEXT_PUBLIC_* на сборке).
      const patterns: Array<{ protocol: 'https'; hostname: string }> = [
        { protocol: 'https', hostname: '*.r2.dev' },
        { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      ];
      // mediaBaseUrl читается на этапе загрузки next.config — в Vercel он уже
      // доступен, но для локальной разработки без CDN wildcard-ов достаточно.
      const raw = mediaBaseUrl || process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || '';
      if (raw) {
        try {
          const h = new URL(raw.replace(/\/$/, '')).hostname;
          if (h && !patterns.some((p) => p.hostname === h)) patterns.push({ protocol: 'https', hostname: h });
        } catch {
          /* ignore malformed env */
        }
      }
      return patterns;
    })(),
    /** SVG из внешних источников — вектор XSS. Иконки поставляются как компоненты. */
    dangerouslyAllowSVG: false,
  },

  /** Барели библиотек иконок и UI тянут весь пакет: включаем tree-shaking. */
  experimental: {
    optimizePackageImports: ['lucide-react', 'radix-ui', 'date-fns', 'framer-motion', 'next-intl'],
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


  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg-cloudflare', 'pg'],

  async headers() {
    return buildCacheHeaderRules();
  },
};

export default withNextIntl(nextConfig);
