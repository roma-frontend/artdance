/**
 * MEDIA — единая политика изображений и видео.
 *
 * Ни один `sizes`, `width`, `quality` или путь к плейсхолдеру не должен
 * писаться в компоненте руками: рассинхрон `sizes` и реальной вёрстки — главная
 * причина проваленного LCP. Все presets описаны здесь и проверяются в одном месте.
 */

// Относительный импорт: этот модуль читается из next.config.ts, где алиасы
// путей ещё не разрешаются.
import { raw } from '../design/tokens';

/**
 * База для публичных URL медиа: R2/CDN, иначе локальный `/public`.
 *
 * Читается напрямую из process.env, а не из clientEnv: next.config.ts
 * импортирует этот модуль на этапе загрузки конфига (next build → load
 * next.config.ts → import media.ts). Если media.ts тянет валидацию env.ts,
 * сборка падает до компиляции при любом отсутствующем NEXT_PUBLIC_* —
 * именно это ломал Cloudflare Workers Builds, где vars доступны только
 * в рантайме Worker, а NEXT_PUBLIC_* инлайнятся на этапе сборки.
 */
const candidates = [
  (process.env.NEXT_PUBLIC_MEDIA_CDN_URL ?? '').trim(),
  (process.env.R2_PUBLIC_BASE_URL ?? '').trim(),
  (process.env.R2_PUBLIC_URL ?? '').trim(),
];
const rawMediaBaseUrl =
  candidates.find((value) => value.length > 0 && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(value)) ?? '';
export const mediaBaseUrl = rawMediaBaseUrl;

/** Ширины, для которых генерируются варианты. Совпадают с `next.config` deviceSizes. */
export const imageWidths = [320, 420, 640, 768, 1024, 1280, 1600, 1920, 2560] as const;

export const imageQuality = {
  thumbnail: 70,
  standard: 78,
  hero: 82,
  /** Для editorial-кадров, где важна тональность в тенях. */
  editorial: 88,
} as const;

/**
 * Presets: каждая роль изображения в дизайне описана один раз.
 * `sizes` рассчитан под сетки из `final.html` и точки перелома из токенов.
 */
export const imagePresets = {
  heroFullBleed: {
    aspectRatio: raw.aspectRatio.cinema,
    sizes: '100vw',
    quality: imageQuality.hero,
    priority: true,
  },
  editorialFullBleed: {
    aspectRatio: raw.aspectRatio.cinema,
    sizes: '100vw',
    quality: imageQuality.editorial,
    priority: false,
  },
  categoryCard: {
    aspectRatio: raw.aspectRatio.portrait,
    sizes: `(max-width: ${raw.breakpoint.xs}px) 50vw, (max-width: ${raw.breakpoint.lg}px) 33vw, 20vw`,
    quality: imageQuality.thumbnail,
    priority: false,
  },
  classCard: {
    aspectRatio: raw.aspectRatio.landscape,
    sizes: `(max-width: ${raw.breakpoint.md}px) 85vw, 320px`,
    quality: imageQuality.standard,
    priority: false,
  },
  instructorCard: {
    aspectRatio: raw.aspectRatio.square,
    sizes: `(max-width: ${raw.breakpoint.md}px) 100vw, (max-width: ${raw.breakpoint.lg}px) 50vw, 25vw`,
    quality: imageQuality.standard,
    priority: false,
  },
  instructorHero: {
    aspectRatio: raw.aspectRatio.portrait,
    sizes: `(max-width: ${raw.breakpoint.lg}px) 100vw, 480px`,
    quality: imageQuality.editorial,
    priority: true,
  },
  eventSpotlight: {
    aspectRatio: raw.aspectRatio.landscape,
    sizes: `(max-width: ${raw.breakpoint.md}px) 100vw, 50vw`,
    quality: imageQuality.standard,
    priority: false,
  },
  studioCard: {
    aspectRatio: raw.aspectRatio.landscape,
    sizes: `(max-width: ${raw.breakpoint.md}px) 100vw, (max-width: ${raw.breakpoint.lg}px) 50vw, 33vw`,
    quality: imageQuality.standard,
    priority: false,
  },
  productCard: {
    aspectRatio: raw.aspectRatio.poster,
    sizes: `(max-width: ${raw.breakpoint.md}px) 50vw, (max-width: ${raw.breakpoint.lg}px) 33vw, 25vw`,
    quality: imageQuality.standard,
    priority: false,
  },
  productGallery: {
    aspectRatio: raw.aspectRatio.poster,
    sizes: `(max-width: ${raw.breakpoint.lg}px) 100vw, 620px`,
    quality: imageQuality.editorial,
    priority: true,
  },
  avatar: {
    aspectRatio: raw.aspectRatio.square,
    sizes: '48px',
    quality: imageQuality.thumbnail,
    priority: false,
  },
  avatarLarge: {
    aspectRatio: raw.aspectRatio.square,
    sizes: '120px',
    quality: imageQuality.standard,
    priority: false,
  },
  thumbnail: {
    aspectRatio: raw.aspectRatio.square,
    sizes: '96px',
    quality: imageQuality.thumbnail,
    priority: false,
  },
} as const;

export type ImagePresetKey = keyof typeof imagePresets;

/**
 * Роли, для которых у `Media` есть заглушка.
 *
 * Это список ролей, а не путей к файлам, и причина конкретная: раньше здесь
 * лежали шесть ссылок на `/media/fallback/*.svg`, которых в `public` нет —
 * первая же сущность без фотографии получала 404 вместо заглушки. Файлы не
 * добавлены осознанно:
 *
 *   • `next/image` не отдаёт SVG при `dangerouslyAllowSVG: false` (и отключать
 *     это ради заглушки нельзя — SVG из внешних источников это вектор XSS);
 *   • растровый файл не переключает тему: на тёмной странице светлая плитка
 *     выглядит дырой в вёрстке;
 *   • ни один цвет заглушки не должен быть литералом в `public`.
 *
 * Поэтому заглушку рисует сам компонент — подложкой из токенов и иконкой
 * `lucide-react`. Соответствие «роль → иконка» живёт рядом с разметкой
 * (`components/ui/media.tsx`), как и у `StatusBadge`.
 */
export const mediaFallbackKinds = [
  'avatar',
  'instructor',
  'studio',
  'product',
  'classCard',
  'event',
] as const;

export type MediaFallbackKind = (typeof mediaFallbackKinds)[number];

/** Ключи бакета — путь к файлу строится только через эти функции. */
export const mediaPaths = {
  brandLogo: () => `brand/logo.png`,
  brandLogoOnDark: () => `brand/logo-on-dark.png`,
  instructorPhoto: (instructorId: string, fileId: string) => `instructors/${instructorId}/${fileId}`,
  studioPhoto: (studioId: string, fileId: string) => `studios/${studioId}/${fileId}`,
  classPhoto: (classId: string, fileId: string) => `classes/${classId}/${fileId}`,
  productImage: (productId: string, fileId: string) => `products/${productId}/${fileId}`,
  eventCover: (eventId: string, fileId: string) => `events/${eventId}/${fileId}`,
  courseCover: (courseId: string, fileId: string) => `courses/${courseId}/${fileId}`,
  avatar: (userId: string, fileId: string) => `avatars/${userId}/${fileId}`,
  editorial: (slug: string, fileId: string) => `editorial/${slug}/${fileId}`,
  bannerImage: (bannerId: string, fileId: string) => `banners/${bannerId}/${fileId}`,
  blogCover: (blogPostId: string, fileId: string) => `blog/${blogPostId}/${fileId}`,
} as const;

/** Ключи статических бренд-ассетов в R2. Хранятся как обычные объекты, без связи с сущностью. */
export const brandAssetKeys = {
  logo: 'brand/logo.png',
  logoOnDark: 'brand/logo-on-dark.png',
} as const;

/** Пресеты для новых ролей upload (используются в обработке). */
export const uploadImagePresets = {
  bannerImage: 'heroFullBleed' as const,
  blogCover: 'editorialFullBleed' as const,
  courseCover: 'classCard' as const,
} as const;

/** Публичный URL по ключу бакета или пути из `public/media`. */
export function mediaUrl(key: string): string {
  if (!key) return '';
  const hashAt = key.indexOf('#');
  const cleanKey = hashAt === -1 ? key : key.slice(0, hashAt);
  if (cleanKey.startsWith('http')) return cleanKey;
  // R2 public base: из media.ts (NEXT_PUBLIC_MEDIA_CDN_URL) или алиасов процесса (R2_PUBLIC_URL)
  const cdn =
    mediaBaseUrl ||
    (typeof process !== 'undefined' ? (process.env.R2_PUBLIC_BASE_URL?.trim() || process.env.R2_PUBLIC_URL?.trim() || '') : '');
  if (cleanKey.startsWith('/')) {
    if (cleanKey.startsWith('/media/')) {
      if (cdn) return `${cdn.replace(/\/$/, '')}${cleanKey}`;
      return cleanKey;
    }
    if (cdn) return `${cdn.replace(/\/$/, '')}${cleanKey}`;
    return cleanKey;
  }
  // Bare R2 key: `instructors/...`, `events/...` → CDN, иначе локально `/media/uploads/...`
  if (cdn) return `${cdn.replace(/\/$/, '')}/${cleanKey}`;
  return `/media/uploads/${cleanKey}`;
}

/** URL для ассетов из `public/media/...` — оборачивает `mediaUrl` для читаемости. */
export function publicMediaUrl(path: string): string {
  return mediaUrl(path);
}

/**
 * Blur-плейсхолдер по умолчанию: 1×1 в цвете ivory-400, чтобы избежать «мигания»
 * белым. Используется только когда у ассета нет собственного `blurDataUrl`
 * (см. `mediaProcessing.blur` — конвейер генерирует его при загрузке).
 */
export const blurDataUrl =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNFOEUxRDYiLz48L3N2Zz4=';

/* ────────────────────────────────────────────────────────────────────────────
   ОБРАБОТКА ИЗОБРАЖЕНИЙ
   ────────────────────────────────────────────────────────────────────────────
   Политика живёт в `./media-processing`: этот модуль читает `clientEnv`, а
   конвейер и скрипты обработки должны работать без заполненного окружения
   (`npm run media:check` выполняется в CI). Здесь — только реэкспорт, чтобы у
   приложения оставалась одна точка импорта медиа-настроек.
   ──────────────────────────────────────────────────────────────────────────── */

export {
  mediaProcessing,
  presetBudget,
  variantKey,
  videoLoopKeys,
  videoLoopPolicy,
  videoProcessing,
  type MediaBudgetGroup,
  type MediaOutputFormat,
  type VideoLoopKey,
  type VideoLoopPolicy,
} from './media-processing';

/** Видео-курсы (Phase 3). Держим здесь, чтобы плеер не знал про провайдера. */
export const videoConfig = {
  provider: 'cloudflare-stream',
  defaultPlaybackQuality: 'auto',
  signedUrlTtlSeconds: 3_600,
  thumbnailTimeSeconds: 3,
  allowDownload: false,
} as const;
