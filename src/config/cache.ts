/**
 * CACHE — политика кеширования как данные.
 *
 * Идея перенята из `online-shop` и решает конкретную экономическую задачу:
 * публичный каталог не содержит персональных данных в серверном HTML (корзина,
 * авторизация и избранное живут в клиентском состоянии), поэтому CDN может
 * отдавать готовую оболочку и **не вызывать serverless-функцию** на повторных
 * просмотрах. Это одновременно быстрее для пользователя и дешевле в счёте.
 *
 * Правило: любой маршрут с персональными данными обязан попасть в
 * `privatePaths` и получить `no-store`. Ошибка в эту сторону — утечка чужого
 * заказа из CDN-кеша, поэтому список приватного ведётся явно, а не по остатку,
 * а его приоритет над публичными шаблонами проверяется на живой сборке
 * (`e2e/commerce-screens.spec.ts`, блок «Кеширование»).
 */

// Относительный импорт: этот модуль читается из next.config.ts, где алиасы
// путей ещё не разрешаются.
import { locales } from '../i18n/config';

/** Значения Cache-Control, сгруппированные по назначению. */
export const cacheControl = {
  /** Никогда не кешировать: персональные страницы, API, платежи. */
  none: 'no-store, max-age=0, must-revalidate',
  /** Каталог: обновляется часто, допускается лёгкая устарелость. */
  catalog: 'public, s-maxage=180, stale-while-revalidate=600',
  /** Статические информационные страницы. */
  content: 'public, s-maxage=3600, stale-while-revalidate=86400',
  /** Правовые документы: меняются редко. */
  legal: 'public, s-maxage=86400, stale-while-revalidate=604800',
  /** Файлы с хешем в имени. */
  immutable: 'public, max-age=31536000, immutable',
  /** Медиа из объектного хранилища: имена уникальны, но не хешированы. */
  media: 'public, max-age=2592000, stale-while-revalidate=86400',
} as const;

/**
 * Маршруты каталога. Указываются без префикса локали — он добавляется
 * автоматически для всех языков.
 */
export const catalogPaths = [
  '/',
  '/discover',
  '/classes',
  '/classes/:slug*',
  '/styles',
  '/styles/:slug*',
  '/instructors',
  '/instructors/:slug*',
  '/studios',
  '/studios/:slug*',
  '/events',
  '/events/:slug*',
  '/courses',
  '/courses/:slug*',
  '/shop',
  '/shop/:slug*',
] as const;

export const contentPaths = [
  '/about',
  '/contact',
  '/faq',
  '/help',
  '/pricing',
  '/blog',
  '/blog/:slug*',
  '/become-instructor',
  '/list-your-studio',
  '/gift-cards',
] as const;

export const legalPaths = ['/legal/:path*'] as const;

/**
 * Карточки ссылок для соцсетей.
 *
 * Отдельное правило, потому что иначе карточка занятия получает каталожные 180
 * секунд от `/classes/:slug*` — а мессенджеры и поисковики перезапрашивают
 * превью часто, и каждый такой запрос попадал бы в функцию мимо CDN. Меняться
 * карточка без нового адреса не может: Next подписывает его отпечатком
 * содержимого. Срок тот же, что у медиа из бакета, — по той же причине.
 *
 * Правило должно идти ПОСЛЕ каталожных и контентных: при совпадении нескольких
 * шаблонов значение ставит последнее.
 */
export const openGraphImagePaths = ['/:path*/opengraph-image', '/opengraph-image'] as const;

/**
 * Приватные маршруты. Ведётся явно: ошибка в эту сторону означает утечку
 * персональных данных через CDN.
 */
export const privatePaths = [
  '/cart',
  '/checkout',
  '/checkout/:path*',
  '/booking',
  '/booking/:path*',
  /*
   * Бронирование у инструктора лежит под каталожным `/instructors/:slug*`, но
   * кешироваться не должно: на странице набор свободных слотов, а устаревший
   * ответ здесь означает двойную бронь (`dataRevalidate.availability = 0`).
   * Работает благодаря тому, что приватные правила идут в `headers()`
   * ПОСЛЕДНИМИ — см. `buildCacheHeaderRules`.
   */
  '/instructors/:slug/book',
  '/account',
  '/account/:path*',
  '/studio',
  '/studio/:path*',
  '/venue',
  '/venue/:path*',
  '/admin',
  '/admin/:path*',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password/:path*',
  '/verify-email/:path*',
] as const;

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

/** Разворачивает путь во все локали: `/shop` → `/hy/shop`, `/ru/shop`, `/en/shop`. */
function withLocales(paths: readonly string[], value: string): HeaderRule[] {
  return locales.flatMap((locale) =>
    paths.map((path) => ({
      source: path === '/' ? `/${locale}` : `/${locale}${path}`,
      headers: [{ key: 'Cache-Control', value }],
    })),
  );
}

/**
 * Правила для `next.config.ts → headers()`.
 *
 * **Порядок важен, и он обратный интуиции: при совпадении нескольких шаблонов
 * значение заголовка ставит ПОСЛЕДНЕЕ правило.** Поэтому приватные маршруты идут
 * в конце — иначе `/hy/instructors/:slug/book` (страница бронирования, где лежит
 * набор свободных слотов) получал бы `public, s-maxage=180` от каталожного
 * `/hy/instructors/:slug*`, потому что тот шаблон покрывает и вложенный путь.
 * Проверяется на живой сборке: `e2e/commerce-screens.spec.ts`, блок
 * «Кеширование» — предположение о порядке нельзя держать в комментарии, оно
 * стоит выдачи чужого заказа из CDN.
 */
export function buildCacheHeaderRules(): HeaderRule[] {
  return [
    ...withLocales(legalPaths, cacheControl.legal),
    ...withLocales(contentPaths, cacheControl.content),
    ...withLocales(catalogPaths, cacheControl.catalog),
    ...withLocales(openGraphImagePaths, cacheControl.media),
    {
      // API по умолчанию не кешируется. Прокси медиа ставит свой заголовок сам.
      source: '/api/((?!media).*)',
      headers: [{ key: 'Cache-Control', value: cacheControl.none }],
    },
    {
      source: '/media/:path*',
      headers: [{ key: 'Cache-Control', value: cacheControl.media }],
    },
    /* Последними: приватное перебивает любой публичный шаблон, который его задел. */
    ...withLocales(privatePaths, cacheControl.none),
  ];
}

/* ─────────────────────────── Теги ревалидации ─────────────────────────── */

/**
 * Именованные теги для `revalidateTag()`. Строковые литералы тегов в коде
 * запрещены: опечатка в теге — это молча не инвалидированный кеш, худший вид
 * бага, потому что он не воспроизводится локально.
 */
export const cacheTags = {
  instructors: () => 'instructors',
  instructor: (slug: string) => `instructor:${slug}`,
  classes: () => 'classes',
  class: (slug: string) => `class:${slug}`,
  venues: () => 'venues',
  venue: (slug: string) => `venue:${slug}`,
  events: () => 'events',
  event: (slug: string) => `event:${slug}`,
  courses: () => 'courses',
  course: (slug: string) => `course:${slug}`,
  products: () => 'products',
  product: (slug: string) => `product:${slug}`,
  catalogStats: () => 'catalog-stats',
  /** Доступность конкретного ресурса на конкретную дату. */
  availability: (resourceId: string, isoDate: string) => `availability:${resourceId}:${isoDate}`,
} as const;

/**
 * Время жизни кеша данных (не HTML), в секундах.
 * Доступность слотов не кешируется вообще: устаревший ответ здесь означает
 * двойную бронь.
 */
export const dataRevalidate = {
  catalog: 180,
  entity: 300,
  catalogStats: 3_600,
  content: 3_600,
  availability: 0,
} as const;
