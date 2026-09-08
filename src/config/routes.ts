/**
 * ROUTES — типизированная карта путей.
 *
 * В коде запрещены строковые литералы путей: `href="/instructors/anna"` →
 * `href={routes.instructor(slug)}`. Переименование раздела = правка одной строки
 * здесь, а не поиск по проекту.
 *
 * Локаль подставляется middleware next-intl, поэтому пути указаны без префикса.
 */

export const routes = {
  /* Публичная часть */
  home: () => '/',
  discover: (params?: ListingParams) => withQuery('/discover', params),

  classes: (params?: ListingParams) => withQuery('/classes', params),
  class: (slug: string) => `/classes/${slug}`,

  /**
   * Направления танца. Хаб направления — не то же самое, что каталог с фильтром:
   * `/classes?style=salsa` отвечает «вот занятия», а `/styles/salsa` — «вот что
   * такое сальса, кто её ведёт, где ей учат и сколько это стоит». Первый адрес
   * нужен человеку, который уже выбрал; второй — тому, кто ищет «уроки сальсы в
   * Ереване» в поисковике, и именно он индексируется.
   *
   * Слаг собирается `danceStyleSlug()`, а не пишется строкой.
   */
  styles: () => '/styles',
  style: (slug: string) => `/styles/${slug}`,

  courses: () => '/courses',
  course: (slug: string) => `/courses/${slug}`,
  courseLesson: (courseSlug: string, lessonSlug: string) => `/courses/${courseSlug}/${lessonSlug}`,

  instructors: (params?: ListingParams) => withQuery('/instructors', params),
  instructor: (slug: string) => `/instructors/${slug}`,
  instructorBooking: (slug: string) => `/instructors/${slug}/book`,

  studios: (params?: ListingParams) => withQuery('/studios', params),
  studio: (slug: string) => `/studios/${slug}`,
  studioBooking: (slug: string) => `/studios/${slug}/book`,

  events: (params?: ListingParams) => withQuery('/events', params),
  event: (slug: string) => `/events/${slug}`,

  shop: (params?: ShopParams) => withQuery('/shop', params),
  product: (slug: string) => `/shop/${slug}`,
  cart: () => '/cart',

  /* Оформление */
  checkout: () => '/checkout',
  checkoutStep: (step: CheckoutStep) => `/checkout/${step}`,
  checkoutResult: (orderNumber: string) => `/checkout/result/${orderNumber}`,

  /* Бронирование */
  booking: () => '/booking',
  bookingConfirm: (holdId: string) => `/booking/${holdId}/confirm`,

  /* Аутентификация */
  signIn: (redirectTo?: string) => withQuery('/sign-in', redirectTo ? { redirectTo } : undefined),
  signUp: (redirectTo?: string) => withQuery('/sign-up', redirectTo ? { redirectTo } : undefined),
  forgotPassword: () => '/forgot-password',
  resetPassword: (token: string) => `/reset-password/${token}`,
  verifyEmail: (token: string) => `/verify-email/${token}`,

  /* Кабинет клиента */
  account: () => '/account',
  accountBookings: () => '/account/bookings',
  accountBooking: (id: string) => `/account/bookings/${id}`,
  accountOrders: () => '/account/orders',
  accountOrder: (orderNumber: string) => `/account/orders/${orderNumber}`,
  accountFavorites: () => '/account/favorites',
  accountReviews: () => '/account/reviews',
  accountSubscription: () => '/account/subscription',
  accountSettings: () => '/account/settings',

  /* Кабинет инструктора */
  instructorDashboard: () => '/studio',
  instructorSchedule: () => '/studio/schedule',
  instructorAvailability: () => '/studio/availability',
  instructorClasses: () => '/studio/classes',
  instructorRequests: () => '/studio/requests',
  instructorEarnings: () => '/studio/earnings',
  instructorProfile: () => '/studio/profile',

  /* Кабинет владельца площадки */
  venueDashboard: () => '/venue',
  venueRooms: () => '/venue/rooms',
  venueCalendar: () => '/venue/calendar',
  venueEarnings: () => '/venue/earnings',

  /* Админ-панель */
  admin: () => '/admin',
  adminOrders: () => '/admin/orders',
  adminBookings: () => '/admin/bookings',
  adminCatalog: () => '/admin/catalog',
  adminInstructors: () => '/admin/instructors',
  adminVenues: () => '/admin/venues',
  adminUsers: () => '/admin/users',
  adminPayouts: () => '/admin/payouts',
  adminPromotions: () => '/admin/promotions',
  adminModeration: () => '/admin/moderation',
  adminReports: () => '/admin/reports',
  adminAuditLog: () => '/admin/audit-log',
  adminSettings: () => '/admin/settings',

  /* Контент и правовые страницы */
  about: () => '/about',
  contact: () => '/contact',
  faq: () => '/faq',
  help: () => '/help',
  blog: () => '/blog',
  blogPost: (slug: string) => `/blog/${slug}`,
  becomeInstructor: () => '/become-instructor',
  listYourStudio: () => '/list-your-studio',
  giftCards: () => '/gift-cards',
  pricing: () => '/pricing',

  /**
   * Рассылка. Подтверждение и отписка — отдельные маршруты с одноразовым
   * токеном: подписать чужой адрес не должно быть возможно, а отписка обязана
   * работать из письма одним переходом, без входа в аккаунт.
   */
  newsletterConfirm: (token: string) => `/newsletter/confirm/${token}`,
  newsletterUnsubscribe: (token: string) => `/newsletter/unsubscribe/${token}`,

  terms: () => '/legal/terms',
  privacy: () => '/legal/privacy',
  refundPolicy: () => '/legal/refund-policy',
  cancellationPolicy: () => '/legal/cancellation-policy',
  cookiePolicy: () => '/legal/cookies',
  communityGuidelines: () => '/legal/community-guidelines',
} as const;

/** API / Route Handlers. Отделены от UI-путей: у них своя политика кеша и авторизации. */
export const apiRoutes = {
  auth: (segments: string) => `/api/auth/${segments}`,
  search: () => '/api/search',
  availability: () => '/api/availability',
  slotHold: () => '/api/booking/hold',
  paymentIntent: () => '/api/payments/intent',
  paymentWebhook: (provider: string) => `/api/webhooks/payments/${provider}`,
  emailWebhook: () => '/api/webhooks/email',
  uploadSignature: () => '/api/media/signature',
  vitals: () => '/api/vitals',
  cron: (job: string) => `/api/cron/${job}`,
} as const;

/* ─────────────────────── Типы параметров ─────────────────────── */

export const checkoutSteps = ['contact', 'delivery', 'payment', 'confirm'] as const;
export type CheckoutStep = (typeof checkoutSteps)[number];

/**
 * Параметры листинга каталога.
 *
 * Один тип на все листинги, а не три почти одинаковых. Разница между
 * `/discover`, `/instructors` и `/studios` — в том, какие параметры экран
 * учитывает, а не в том, как они называются: `?style=salsa&sort=priceAsc`
 * обязан означать одно и то же везде, иначе фильтр, перенесённый между
 * разделами, тихо перестаёт работать.
 *
 * Экран объявляет поддерживаемые фильтры сам (`availableSorts`,
 * `DiscoverFilters`); неизвестный параметр отбрасывается при разборе
 * (`parseCatalogQuery`), а не ломает страницу.
 */
export interface ListingParams {
  /**
   * Свободный запрос из поисковой строки первого экрана.
   *
   * В URL, а не в состоянии: ссылка на результаты обязана открываться у другого
   * человека и индексироваться. Отсюда же вырастет ассистент — он будет писать
   * в тот же параметр.
   */
  q?: string;
  style?: string;
  level?: string;
  /**
   * Район города, а не город: платформа работает в Ереване, и «Kentron» —
   * то, по чему человек действительно выбирает зал рядом с домом. Параметр
   * города появится вместе со вторым городом, а не заранее.
   */
  district?: string;
  date?: string;
  priceMin?: number;
  priceMax?: number;
  /** Только проверенные инструкторы. Применимо к `/instructors`. */
  verified?: boolean;
  /**
   * Раздел результатов поиска на `/discover`: `classes`, `studios`, `all`.
   * Значения — `searchScopes`; в URL, потому что выбранный раздел обязан
   * открываться по прямой ссылке, как и любой другой фильтр.
   */
  scope?: string;
  sort?: string;
  page?: number;
}

/** Магазин добавляет к общим фильтрам свойства товара. */
export interface ShopParams extends ListingParams {
  category?: string;
  size?: string;
  color?: string;
}

/** Сериализация query без `undefined`/пустых значений — стабильные URL для кеша и SEO. */
function withQuery(path: string, params?: object): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/* ─────────────────────────── Разделы каталога ───────────────────────────
 *
 * Раздел листинга — значение, а не функция, и это требование границы
 * сервер/клиент, а не вкусовщина: фильтры и сортировка живут в клиентском
 * компоненте, а функцию в клиентский компонент передать нельзя («Functions
 * cannot be passed directly to Client Components»). Поэтому страница сообщает
 * оболочке, КАКОЙ она раздел, а адрес по разделу собирает уже сама оболочка —
 * через `routes`, а не через склейку строк.
 */

export const listingSections = [
  'discover',
  'classes',
  'instructors',
  'studios',
  'events',
  'shop',
] as const;

export type ListingSection = (typeof listingSections)[number];

/**
 * Маршрут листинга по разделу.
 *
 * Тип параметра — `ShopParams`: он расширяет `ListingParams`, поэтому маршрут,
 * принимающий общие фильтры, подходит под общую подпись, а `/shop` дополнительно
 * понимает размер и цвет.
 */
export const listingRoute: Record<ListingSection, (params?: ShopParams) => string> = {
  discover: routes.discover,
  classes: routes.classes,
  instructors: routes.instructors,
  studios: routes.studios,
  events: routes.events,
  shop: routes.shop,
};

/** Пути, требующие аутентификации. Используется middleware — не дублировать список. */
export const protectedPathPrefixes = ['/account', '/studio', '/venue', '/admin', '/checkout'] as const;

/**
 * Путь под защитой?
 *
 * Сравнение по сегментам, а не по префиксу строки, и это не педантизм:
 * `'/studios'.startsWith('/studio')` — правда, поэтому публичный листинг залов
 * уезжал на страницу входа вместе с кабинетом владельца. Дефект такого рода не
 * видят ни типы, ни сборка: раздел просто перестаёт существовать. Та же ловушка
 * ждала бы `/venue` и `/venues`.
 */
export function isProtectedPath(pathWithoutLocale: string): boolean {
  return protectedPathPrefixes.some(
    (prefix) => pathWithoutLocale === prefix || pathWithoutLocale.startsWith(`${prefix}/`),
  );
}

/** Пути, закрытые от индексации. Попадает в `robots.ts`. */
export const noIndexPathPrefixes = [
  '/account',
  '/studio',
  '/venue',
  '/admin',
  '/checkout',
  '/cart',
  '/api',
  '/sign-in',
  '/sign-up',
  '/reset-password',
  '/verify-email',
] as const;
