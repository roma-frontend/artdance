/**
 * ROUTES — типизированная карта путей.
 *
 * В коде запрещены строковые литералы путей: `href="/instructors/anna"` →
 * `href={routes.instructor(slug)}`. Переименование раздела = правка одной строки
 * здесь, а не поиск по проекту.
 *
 * Локаль подставляется middleware next-intl, поэтому пути указаны без префикса.
 */

/* ───────────────────────── Ресурсы админки ─────────────────────────
 *
 * Сегмент пути и идентификатор ресурса — одно и то же значение: это позволяет
 * одной динамической странице обслуживать все разделы, а реестру — находить
 * обработчик по адресу. Порядок влияет только на отчёты; в навигации разделы
 * группируются отдельно (`src/config/admin.ts`).
 *
 * Вложенные сущности (проведения, залы, варианты, уроки) — полноценные ресурсы
 * с фильтром по родителю (`?parent=<id>`), а не подстраницы: список проведений
 * занятия и список всех проведений — один и тот же экран с разным фильтром.
 */
export const adminResources = [
  'classes',
  'sessions',
  'instructors',
  'venues',
  'rooms',
  'products',
  'categories',
  'variants',
  'events',
  'courses',
  'lessons',
  'promo-codes',
  'gift-cards',
  'media',
] as const;

export type AdminResource = (typeof adminResources)[number];

const adminResourceSet = new Set<string>(adminResources);

export function isAdminResource(value: string): value is AdminResource {
  return adminResourceSet.has(value);
}

/**
 * Параметры списка админки. Те же соображения, что у `ListingParams`: состояние
 * таблицы живёт в URL, иначе ссылку на «отклонённые отзывы за март» нельзя
 * переслать коллеге, а кнопка «назад» теряет фильтр.
 */
export interface AdminListParams {
  q?: string;
  status?: string;
  sort?: string;
  page?: number;
  /** Идентификатор родительской записи для вложенных ресурсов. */
  parent?: string;
  /** Раздел экрана с несколькими очередями (модерация, промо). */
  tab?: string;
  /** Диапазон отчёта. */
  range?: string;
}

/** Корень админки. Отсюда выводятся и адреса разделов, и признак `isAdminPath`. */
const adminRoot = '/admin';

function adminPath(segment: string): string {
  return `${adminRoot}/${segment}`;
}

/**
 * Путь ведёт в админку.
 *
 * Нужен раме сайта: публичная шапка, мобильный док и декоративные слои в
 * инструменте лишние, а layout админки убрать их не может — он вложен в общий
 * layout локали, и родительская разметка ребёнку недоступна. Признак объявлен
 * здесь, рядом с адресами, а не строкой `startsWith('/admin')` в компоненте:
 * переименование раздела не должно оставлять шапку висеть над сайдбаром.
 *
 * Путь ожидается БЕЗ префикса локали — таким его отдаёт `usePathname` next-intl.
 */
export function isAdminPath(pathWithoutLocale: string): boolean {
  return pathWithoutLocale === adminRoot || pathWithoutLocale.startsWith(`${adminRoot}/`);
}

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
  /**
   * Ссылка сброса пароля.
   *
   * Токен в query, а не в сегменте пути: Better Auth формирует ссылку из письма
   * как `{redirectTo}?token=…`, и подстроить под неё сегмент невозможно — токен
   * генерируется на сервере в момент отправки. Секрет в query здесь безопаснее
   * обычного: страница отдаётся с `no-store`, а `Referrer-Policy` не пускает
   * адрес во внешние запросы.
   */
  resetPassword: (token?: string) => withQuery('/reset-password', token ? { token } : undefined),
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

  /* ─────────────────────────── Админ-панель ───────────────────────────
   *
   * Разделы админки описываются `adminResources`, а не двадцатью строками
   * вида `adminClasses: () => '/admin/classes'`. Причина не в экономии строк:
   * каждый раздел обслуживают ОДНИ И ТЕ ЖЕ три страницы
   * (`/admin/[resource]`, `/admin/[resource]/new`, `/admin/[resource]/[id]`),
   * и список сегментов — это и список маршрутов, и список ресурсов реестра.
   * Добавить раздел = добавить сегмент здесь и обработчик в реестре.
   *
   * Экраны со своей логикой (заказы, брони, модерация, права, аудит, отчёты)
   * остаются отдельными маршрутами: их нельзя свести к «список + форма».
   */
  admin: () => adminRoot,
  adminResource: (resource: AdminResource, params?: AdminListParams) =>
    withQuery(adminPath(resource), params),
  adminResourceNew: (resource: AdminResource, parent?: string) =>
    withQuery(`${adminPath(resource)}/new`, parent ? { parent } : undefined),
  adminResourceEdit: (resource: AdminResource, id: string) => `${adminPath(resource)}/${id}`,

  adminCatalog: () => adminPath('catalog'),
  adminOrders: (params?: AdminListParams) => withQuery(adminPath('orders'), params),
  adminOrder: (id: string) => `${adminPath('orders')}/${id}`,
  adminBookings: (params?: AdminListParams) => withQuery(adminPath('bookings'), params),
  adminBooking: (id: string) => `${adminPath('bookings')}/${id}`,
  adminUsers: (params?: AdminListParams) => withQuery(adminPath('users'), params),
  adminUser: (id: string) => `${adminPath('users')}/${id}`,
  adminPayouts: (params?: AdminListParams) => withQuery(adminPath('payouts'), params),
  adminPromotions: () => adminPath('promotions'),
  adminModeration: (params?: AdminListParams) => withQuery(adminPath('moderation'), params),
  adminReports: (params?: AdminListParams) => withQuery(adminPath('reports'), params),
  adminAuditLog: (params?: AdminListParams) => withQuery(adminPath('audit-log'), params),
  adminApprovals: () => adminPath('approvals'),
  adminSettings: () => adminPath('settings'),
  adminTrash: (params?: AdminListParams) => withQuery(adminPath('trash'), params),

  /* Совместимость с ранее объявленными адресами разделов каталога. */
  adminInstructors: (params?: AdminListParams) => withQuery(adminPath('instructors'), params),
  adminVenues: (params?: AdminListParams) => withQuery(adminPath('venues'), params),

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
  /**
   * Загрузка изображения. Route handler, а не server action: файл идёт
   * `multipart/form-data`, и это его родной канал (см. шапку обработчика).
   */
  mediaUpload: () => '/api/media/upload',
  uploadSignature: () => '/api/media/signature',
  vitals: () => '/api/vitals',
  cron: (job: string) => `/api/cron/${job}`,
  /**
   * Задачи по расписанию. Имена объявлены здесь, а не строками в `vercel.json` и
   * в проверках: опечатка в имени даёт 404 у планировщика, а не ошибку сборки.
   */
  cronJobs: { purgeTrash: 'purge-trash' } as const,
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
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;
