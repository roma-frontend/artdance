/**
 * SECURITY — политика безопасности как данные.
 *
 * Ключевое разделение ответственности (перенято из `office` и `online-shop`):
 *   • security-заголовки и CSP живут ТОЛЬКО в `src/proxy.ts`;
 *   • `next.config.ts` отвечает исключительно за Cache-Control.
 * Когда заголовки задаются в двух местах, они конфликтуют, и отладка
 * превращается в угадывание, какой слой победил.
 *
 * CSP собирается БЕЗ nonce — осознанный компромисс. Nonce требует динамического
 * рендеринга каждой страницы, а публичный каталог ArtDance (занятия, инструкторы,
 * площадки, товары) обязан отдаваться с CDN без вызова функции. Цена — необходимый
 * `'unsafe-inline'` для inline-бутстрапа Next.js. Если появится требование строгого
 * CSP, переходить нужно на `'strict-dynamic'` + nonce и одновременно отказываться
 * от CDN-кеша HTML.
 */

import { clientEnv } from './env';

/** Внешние источники, которым разрешено что-либо загружать или принимать. */
const externalOrigins = {
  turnstile: 'https://challenges.cloudflare.com',
  maps: 'https://maps.googleapis.com',
  mapsStatic: 'https://maps.gstatic.com',
  analytics: 'https://eu.i.posthog.com',
  vercelInsights: 'https://va.vercel-scripts.com',
} as const;

const isProduction = clientEnv.NEXT_PUBLIC_APP_ENV === 'production';
const isPreview = clientEnv.NEXT_PUBLIC_APP_ENV === 'preview';

/** В dev нужны eval и websocket для HMR; в preview — оверлей Vercel. */
const devScript = isProduction || isPreview ? '' : " 'unsafe-eval'";
const previewScript = isPreview ? ' https://vercel.live' : '';
const devConnect = isProduction || isPreview ? '' : ' ws: wss:';

function buildCsp(extraScriptSrc = ''): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${externalOrigins.turnstile} ${externalOrigins.vercelInsights} ${externalOrigins.maps}${previewScript}${extraScriptSrc}${devScript}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: https: ${externalOrigins.mapsStatic}`,
    `connect-src 'self' https: ${externalOrigins.analytics}${devConnect}`,
    `frame-src 'self' ${externalOrigins.turnstile}`,
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export const contentSecurityPolicy = buildCsp();

/**
 * Страницы, где нужен виджет сторонней авторизации, получают ослабленную CSP.
 * Отдельная политика на конкретные маршруты — вместо ослабления политики
 * для всего сайта.
 */
export const authContentSecurityPolicy = buildCsp(" 'unsafe-eval'");

export const authCspPathPrefixes = ['/sign-in', '/sign-up'] as const;

/** Заголовки, общие для всех ответов. */
export const baseSecurityHeaders: ReadonlyArray<readonly [string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Frame-Options', 'DENY'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Cross-Origin-Resource-Policy', 'same-origin'],
  [
    'Permissions-Policy',
    [
      'camera=()',
      'microphone=()',
      'geolocation=(self)',
      'payment=()',
      'usb=()',
      'interest-cohort=()',
      'browsing-topics=()',
    ].join(', '),
  ],
  ...(isProduction
    ? ([['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload']] as const)
    : []),
];

/* ───────────────────────────── CSRF ───────────────────────────── */

/**
 * CSRF защищается проверкой заголовка `Origin` на мутирующих методах.
 * Браузер всегда отправляет `Origin` на cross-site запросах, а клиенты без
 * `Origin` (server-to-server, curl) не носят cookies — значит подделать сессию
 * через них невозможно. Это дешевле токенов и не требует хранения состояния.
 */
export const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Пути, где проверка Origin отключена: подпись сама себе аутентификация. */
export const originExemptPathPrefixes = ['/api/webhooks/'] as const;

/* ───────────────────────────── Загрузки ───────────────────────────── */

export const uploadKinds = ['avatar', 'instructorPhoto', 'venuePhoto', 'productImage', 'courseVideo'] as const;
export type UploadKind = (typeof uploadKinds)[number];

export interface UploadPolicy {
  mimeTypes: readonly string[];
  /** Расширения проверяются отдельно от MIME: клиент может подделать любое из двух независимо. */
  extensions: readonly string[];
  maxBytes: number;
  maxPerEntity: number;
}

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif'] as const;
const MB = 1024 * 1024;

export const uploadPolicies: Record<UploadKind, UploadPolicy> = {
  avatar: { mimeTypes: IMAGE_MIME, extensions: IMAGE_EXT, maxBytes: 2 * MB, maxPerEntity: 1 },
  instructorPhoto: { mimeTypes: IMAGE_MIME, extensions: IMAGE_EXT, maxBytes: 8 * MB, maxPerEntity: 12 },
  venuePhoto: { mimeTypes: IMAGE_MIME, extensions: IMAGE_EXT, maxBytes: 8 * MB, maxPerEntity: 12 },
  productImage: { mimeTypes: IMAGE_MIME, extensions: IMAGE_EXT, maxBytes: 8 * MB, maxPerEntity: 12 },
  courseVideo: {
    mimeTypes: ['video/mp4', 'video/quicktime'],
    extensions: ['mp4', 'mov'],
    maxBytes: 512 * MB,
    maxPerEntity: 1,
  },
};

/* ───────────────────────── Webhook-подписи ───────────────────────── */

export const webhookSecurity = {
  /** Окно защиты от реплея. Событие старше — отклоняется. */
  replayToleranceSeconds: 300,
  signatureHeaders: {
    paynet: 'x-paynet-signature',
    'arca-epg': 'x-arca-signature',
    'ameria-vpos': 'x-ameria-signature',
    idram: 'x-idram-signature',
    mock: 'x-mock-signature',
  },
} as const;

/* ───────────────────────── Критичные действия ───────────────────────── */

/**
 * Действия, по которым владельцу платформы уходит немедленное оповещение,
 * помимо записи в audit log. Список короткий намеренно: если алертов много,
 * их перестают читать.
 */
export const criticalAuditActions = [
  'user.roleChanged',
  'user.deleted',
  'user.impersonated',
  'access.capabilityChanged',
  'booking.adminOverride',
  'payment.manualRefund',
  'payout.released',
  'promoCode.created',
  'settings.changed',
  'session.revokedAll',
] as const;

export type CriticalAuditAction = (typeof criticalAuditActions)[number];
