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
  discover: (params?: DiscoverParams) => withQuery('/discover', params),

  classes: () => '/classes',
  class: (slug: string) => `/classes/${slug}`,

  courses: () => '/courses',
  course: (slug: string) => `/courses/${slug}`,
  courseLesson: (courseSlug: string, lessonSlug: string) => `/courses/${courseSlug}/${lessonSlug}`,

  instructors: (params?: InstructorParams) => withQuery('/instructors', params),
  instructor: (slug: string) => `/instructors/${slug}`,
  instructorBooking: (slug: string) => `/instructors/${slug}/book`,

  studios: () => '/studios',
  studio: (slug: string) => `/studios/${slug}`,
  studioBooking: (slug: string) => `/studios/${slug}/book`,

  events: () => '/events',
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

export interface DiscoverParams {
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
  city?: string;
  date?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: string;
  page?: number;
}

export interface InstructorParams {
  style?: string;
  city?: string;
  verified?: boolean;
  sort?: string;
  page?: number;
}

export interface ShopParams {
  category?: string;
  size?: string;
  color?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: string;
  page?: number;
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

/** Пути, требующие аутентификации. Используется middleware — не дублировать список. */
export const protectedPathPrefixes = ['/account', '/studio', '/venue', '/admin', '/checkout'] as const;

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
