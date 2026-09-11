# Каталог хелперов

Что должно существовать как функция, а не повторяться по проекту. Для каждого
модуля указан путь и сигнатура — при старте разработки файл создаётся по этому
описанию, а не проектируется заново.

Уже реализовано и здесь не дублируется: `src/domain/money.ts` (арифметика,
комиссии, НДС, распределение скидки), `src/domain/errors.ts`, `src/domain/enums.ts`,
`src/lib/audit.ts`, `src/lib/auth/*`, `src/lib/payments/*`,
`src/lib/security/{rate-limit,turnstile,uploads,webhook,export-safety}.ts`,
`src/lib/utils.ts` (`cn`).

Правило слоёв сохраняется: хелпер не читает `process.env` (только через
`src/config/env.ts`), не содержит текстов для пользователя и не знает про Prisma,
если он не в `src/server/`.

---

## 1. Два хелпера, которые важнее остальных

`docs/03-conventions.md` §7 требует от каждой мутации пять шагов в строгом
порядке: гвард → rate limit → валидация → операция → инвалидация и аудит.
Требование, которое нужно помнить, нарушается на двадцатой мутации. Требование,
зашитое в обёртку, не нарушается вообще.

```ts
// src/server/action.ts
export function defineAction<TInput extends ZodType, TOutput>(config: {
  name: string;                          // ключ для аудита и аналитики
  input: TInput;
  capability?: CapabilityKey;            // проверяется до всего остального
  rateLimit?: RateLimitKey;
  captcha?: boolean;                     // из security.captchaProtectedActions
  approval?: boolean;                    // maker-checker: создаёт ApprovalRequest
  audit?: { entity: string; captureBefore?: boolean };
  revalidate?: (result: TOutput) => readonly string[];   // теги кеша
  handler: (input: z.infer<TInput>, ctx: ActionContext) => Promise<TOutput>;
}): (raw: unknown) => Promise<Result<TOutput, ActionError>>;
```

```ts
// src/server/query.ts
export function defineQuery<TArgs extends unknown[], TResult>(config: {
  name: string;
  tags: (...args: TArgs) => readonly string[];
  revalidate: number | false;            // из src/config/cache.ts, не число по месту
  handler: (...args: TArgs) => Promise<TResult>;
}): (...args: TArgs) => Promise<TResult>;
```

Почему это стоит сделать первым, ещё в задаче 2.1:

- ни одна мутация не может «забыть» гвард — обёртка не даст;
- `Result` вместо исключений: UI получает предсказуемый ответ, а не пойманный
  stack trace;
- теги кеша объявляются рядом с запросом, поэтому `revalidateTag` не расходится с
  тем, что реально кешировалось;
- имя действия одно и то же в аудите, в Sentry и в аналитике — расследование
  инцидента становится поиском по одной строке.

```ts
// src/lib/result.ts
export type Result<T, E = ActionError> = { ok: true; value: T } | { ok: false; error: E };
export function ok<T>(value: T): Result<T, never>;
export function err<E>(error: E): Result<never, E>;
export function unwrapOr<T>(result: Result<T, unknown>, fallback: T): T;
```

---

## 2. Время и доступность

Ядро самой дорогой части системы. Чистые функции без БД — поэтому полностью
тестируемые, а тесты для бронирования обязательны по конвенциям.

В Армении нет перехода на летнее время с 2012 года, поэтому смещение стабильно
(UTC+4). Это не повод считать в локальном времени сервера: пользователь может
открыть сайт из другого часового пояса, а `User.timeZone` в схеме уже есть.
Библиотека дат не нужна — `Intl` и `Temporal`-совместимая арифметика на минутах
покрывают все случаи и не добавляют килобайт в бандл.

```ts
// src/lib/time/zone.ts
export function zonedParts(date: Date, timeZone?: string): {
  year: number; month: number; day: number; hour: number; minute: number; weekday: number;
};
export function zonedDayStart(date: Date, timeZone?: string): Date;
export function fromZonedTime(parts: DateParts, timeZone?: string): Date;
export function sameZonedDay(a: Date, b: Date, timeZone?: string): boolean;

// src/lib/time/interval.ts
export interface Interval { start: Date; end: Date }
export function overlaps(a: Interval, b: Interval, bufferMinutes?: number): boolean;
export function subtractIntervals(base: Interval, blocks: readonly Interval[]): Interval[];
export function mergeIntervals(list: readonly Interval[]): Interval[];
export function durationMinutes(interval: Interval): number;

// src/lib/time/clock.ts — минуты от полуночи вместо строк «19:30»
export function parseClock(value: string): number;
export function formatClock(minutes: number): string;
export function alignToGranularity(minutes: number, granularity: number): number;
```

```ts
// src/domain/availability/compute.ts
export interface AvailabilityInput {
  rules: readonly AvailabilityRule[];
  exceptions: readonly AvailabilityException[];
  busy: readonly Interval[];             // брони + удержания + аренда комнаты
  holidays: readonly Date[];
  range: Interval;
  durationMinutes: number;
  granularityMinutes: number;
  bufferMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  now: Date;                             // всегда параметром: тесты не зависят от даты запуска
}
export function computeFreeSlots(input: AvailabilityInput): Interval[];
export function expandRules(rules, exceptions, range, timeZone): Interval[];
export function nextAvailableSlots(input: AvailabilityInput, count: number): Interval[];
```

`nextAvailableSlots` — это фича C-02 из бэклога: «мест нет» превращается в три
ближайшие альтернативы одним вызовом.

```ts
// src/domain/availability/conflicts.ts — вызывается внутри транзакции
export function assertNoConflict(existing: readonly Interval[], candidate: Interval, bufferMinutes: number): void;
export function assertCapacity(booked: number, requested: number, capacity: number): void;
export function assertWithinPolicy(candidate: Interval, policy: BookingPolicy, now: Date): void;
```

Уникальные индексы в БД остаются последней линией защиты: эти функции дают
понятную ошибку до записи, индекс — гарантию при гонке.

```ts
// src/domain/booking/policy.ts — окна отмены и переноса, всё из business.booking
export function cancellationOutcome(booking: BookingSnapshot, now: Date):
  { kind: 'free' } | { kind: 'fee'; rate: number; amount: Money } | { kind: 'forbidden'; reason: string };
export function rescheduleOutcome(booking: BookingSnapshot, target: Interval, now: Date): RescheduleOutcome;
export function refundAmountFor(outcome: CancellationOutcome, paid: Money): Money;
```

```ts
// src/domain/holidays.ts
export function armenianPublicHolidays(year: number): readonly Date[];
export function isWorkingDay(date: Date): boolean;
```

Праздники нужны в трёх местах: доступность по умолчанию, сроки доставки,
ожидаемое время ответа инструктора.

---

## 3. Поиск и текст

```ts
// src/lib/search/normalize.ts
/** Приводит запрос к сопоставимому виду: регистр, диакритика, пробелы. */
export function normalizeQuery(input: string): string;
/** Армянский ↔ латиница ↔ кириллица. «Բաչատա», «bachata», «бачата» → один ключ. */
export function transliterate(input: string, target: 'lat' | 'hy' | 'cyr'): string;
/** Все варианты написания запроса — для поиска по индексу. */
export function queryVariants(input: string): readonly string[];
export function levenshteinWithin(a: string, b: string, max: number): boolean;
export function highlightMatches(text: string, query: string): readonly TextChunk[];
```

Без этого поиск на рынке с тремя алфавитами не работает: посетитель с армянской
раскладки не найдёт занятие, названное латиницей. Словарь синонимов и написаний
названий стилей живёт рядом с самими стилями — `src/domain/enums.ts`, а не в
хелпере.

```ts
// src/lib/slug.ts
export function slugify(text: string, locale?: Locale): string;   // через transliterate
export function uniqueSlug(base: string, taken: (candidate: string) => Promise<boolean>): Promise<string>;

// src/lib/text/contacts.ts — защита комиссии (D-01)
/** Ищет телефоны, e-mail, @ник и ссылки на мессенджеры в свободном тексте. */
export function findContactInfo(text: string): readonly ContactMatch[];
/** Маскирует найденное для показа до оплаты. Не удаляет — помечает на модерацию. */
export function maskContactInfo(text: string): string;

// src/lib/text/truncate.ts
export function truncateOnWord(text: string, max: number): string;   // для meta description
export function readingTimeMinutes(text: string, locale: Locale): number;
```

`findContactInfo` — эвристика, и она **не блокирует** отправку: помечает запись на
модерацию. Жёсткая regex-фильтрация пользовательского текста была сознательно
отклонена (`docs/00-decision-record.md`): она ломает легитимный ввод и создаёт
ложное чувство безопасности.

---

## 4. Формат и локаль

```ts
// src/lib/format/phone.ts
export function parseArmenianPhone(input: string): { e164: string; national: string; operator?: string } | null;
export function isMobileNumber(e164: string): boolean;     // маршрутизация SMS
export function formatPhoneForDisplay(e164: string): string;

// src/lib/format/units.ts
export function formatDistanceKm(km: number, locale: Locale): string;
export function formatDurationMinutes(minutes: number, locale: Locale): string;
export function formatFileSize(bytes: number, locale: Locale): string;
export function formatPercent(rate: number, locale: Locale): string;

// src/lib/format/name.ts
export function initials(name: string): string;             // фоллбэк аватара
export function maskName(name: string): string;             // «Анна К.» в публичных отзывах
```

Валюта, даты и числа не форматируются здесь: только через `useFormatter()` и
`formats` в конфигурации next-intl. Дублирование форматов — прямой путь к
«12 000 ֏» в одном месте и «12000 AMD» в другом.

---

## 5. URL, фильтры, пагинация

```ts
// src/lib/url/filters.ts
/** Единственный разбор фильтров. Схема Zod → типизированный объект + обратно. */
export function parseFilters<S extends ZodType>(searchParams: SearchParams, schema: S): z.infer<S>;
export function toSearchParams(filters: object): URLSearchParams;
/** Стабильный порядок ключей: два одинаковых по смыслу URL дают один кеш-ключ и один canonical. */
export function canonicalizeQuery(url: URL, allowed: readonly string[]): URL;

// src/lib/url/cursor.ts
export function encodeCursor(row: { id: string; sortValue: string | number | Date }): string;
export function decodeCursor(cursor: string): { id: string; sortValue: string } | null;

// src/lib/url/absolute.ts
export function absoluteUrl(path: string, locale?: Locale): string;   // из site.url, не из заголовков
```

`canonicalizeQuery` решает конкретную проблему: `?style=salsa&city=yerevan` и
`?city=yerevan&style=salsa` — одна страница. Без нормализации это две записи в
CDN-кеше и дубликат для поисковика.

---

## 6. SEO

```ts
// src/lib/seo/metadata.ts
export function buildMetadata(input: {
  titleKey: string;                 // или готовое имя сущности
  descriptionKey?: string;
  path: string;
  locale: Locale;
  image?: { key: string; alt: string };
  noIndex?: boolean;
  values?: Record<string, string | number>;
}): Metadata;                       // canonical + hreflang для всех локалей + OG + Twitter
```

Одна функция вместо `generateMetadata` с ручным набором полей на каждой из ~30
страниц. Забытый `hreflang` на одной странице — потерянная локаль в выдаче.

```ts
// src/lib/seo/jsonld.ts — по одной функции на тип сущности
export function organizationSchema(): JsonLd;
export function localBusinessSchema(venue: VenueForSchema): JsonLd;
export function personSchema(instructor: InstructorForSchema): JsonLd;
export function eventSchema(event: EventForSchema): JsonLd;
export function courseSchema(course: CourseForSchema): JsonLd;
export function productSchema(product: ProductForSchema): JsonLd;
export function breadcrumbSchema(trail: readonly Crumb[]): JsonLd;
export function faqSchema(items: readonly FaqItem[]): JsonLd;
/** null, если отзывов меньше reviews.minCountToDisplayAverage — иначе разметка врёт. */
export function aggregateRatingSchema(stats: RatingStats): JsonLd | null;
```

```ts
// src/lib/seo/sitemap.ts
export function sitemapEntriesFor(kind: SitemapKind): Promise<MetadataRoute.Sitemap>;
export function hreflangAlternates(path: string): Record<Locale, string>;
```

---

## 7. Кеш и идемпотентность

```ts
// src/lib/cache/tags.ts — теги как функции, не строки по коду
export const cacheTags = {
  catalog: () => 'catalog',
  class: (id: string) => `class:${id}`,
  instructor: (id: string) => `instructor:${id}`,
  venue: (id: string) => `venue:${id}`,
  product: (id: string) => `product:${id}`,
  content: (slug: string) => `content:${slug}`,
} as const;
/** Что инвалидировать при изменении сущности — карта, а не память разработчика. */
export function tagsAffectedBy(entity: EntityKind, id: string): readonly string[];
```

```ts
// src/lib/idempotency.ts
export function idempotencyKey(parts: readonly (string | number)[]): string;
export function withIdempotency<T>(key: string, fn: () => Promise<T>): Promise<T>;
```

Ключ строится из смысловых частей операции, а не из случайного UUID: повторная
отправка формы должна дать тот же ключ, иначе идемпотентность не срабатывает.

---

## 8. Уведомления

```ts
// src/lib/notifications/send.ts
export function notify(input: {
  userId: string;
  type: NotificationType;                 // ключ из config/notifications.ts
  data: Record<string, string | number>;  // подставляется в шаблон
  channels?: readonly NotificationChannel[];  // по умолчанию — из настроек пользователя
  scheduledFor?: Date;
  dedupeKey?: string;                     // одно письмо на бронь, а не по разу на ретрай
}): Promise<void>;

// src/lib/notifications/channels.ts
/** Решает канал: настройки пользователя ∩ матрица типа ∩ тихие часы ∩ лимит SMS. */
export function resolveChannels(type: NotificationType, prefs: readonly NotificationPreference[], now: Date): readonly NotificationChannel[];
/** SMS платные: страховка от рассылки на весь список из-за ошибки в цикле. */
export function assertSmsBudget(count: number, period: 'day' | 'month'): void;

// src/lib/notifications/render.ts
export function renderEmail(type: NotificationType, locale: Locale, data: object): { subject: string; html: string; text: string };
```

Полный перечень транзакционных сообщений (что отправляется, когда, по какому
каналу и что происходит при недоставке) — часть `config/notifications.ts`.
Список в конфиге, а не в документе: иначе он разойдётся с кодом на первой неделе.

---

## 9. Аналитика и эксперименты

```ts
// src/lib/analytics/track.ts
export function track<E extends AnalyticsEvent>(event: E, payload: AnalyticsPayload<E>): void;
export function trackServer<E extends AnalyticsEvent>(event: E, payload: AnalyticsPayload<E>): Promise<void>;
```

`AnalyticsEvent` — union из реестра `src/config/analytics.ts`. Событие как
строковый литерал в компоненте — гарантированный разъезд названий и бесполезная
воронка через месяц.

```ts
// src/lib/experiments.ts
/** Детерминированное распределение: один пользователь всегда в одной группе. */
export function bucketFor(experiment: ExperimentKey, seed: string): string;
export function variantOf(experiment: ExperimentKey, seed: string): ExperimentVariant;
```

---

## 10. Гео и карты

```ts
// src/lib/geo.ts
export function haversineKm(a: LatLng, b: LatLng): number;
export function withinRadius(center: LatLng, point: LatLng, km: number): boolean;
export function boundsFor(points: readonly LatLng[], paddingKm?: number): Bounds;
export function districtOf(point: LatLng): DistrictId | null;
export function staticMapUrl(input: { center: LatLng; zoom: number; pins?: readonly LatLng[]; theme: 'light' | 'dark' }): string;
export function deliveryZoneFor(address: AddressLike): DeliveryZone;
```

`withinRadius` обслуживает `booking.travelRadiusKm`: выезд инструктора нельзя
предлагать по адресу за пределами радиуса. `staticMapUrl` даёт картинку вместо
JS-карты в листингах — это и быстрее, и дешевле по квоте Maps API.

---

## 11. Файлы, документы, обмен данными

```ts
// src/lib/files/csv.ts — экспорт уже защищён в lib/security/export-safety.ts
export function parseCsv<S extends ZodType>(text: string, rowSchema: S): {
  rows: readonly z.infer<S>[];
  errors: readonly { line: number; issues: readonly string[] }[];
};

// src/lib/files/ics.ts
export function buildIcs(input: { uid: string; interval: Interval; title: string; description: string; location?: string; url: string }): string;

// src/lib/files/qr.ts
export function signPassToken(payload: { bookingId: string; expiresAt: Date }): string;   // HMAC
export function verifyPassToken(token: string): { bookingId: string } | null;
export function qrSvg(value: string, size: number): string;                                // SVG, без внешних запросов

// src/lib/files/invoice.ts
export function invoiceModel(order: OrderForInvoice, locale: Locale): InvoiceModel;   // печатная страница; PDF — опция
```

Обработка изображений **уже реализована** — `src/lib/media/ingest.ts`:

```ts
export function inspectImage(input: Buffer): Promise<InspectResult>;   // дешёвый отказ до энкодинга
export function processImage(input: Buffer, options?: ProcessOptions): Promise<IngestResult>;
export function describeImage(input: Buffer): Promise<{ width; height; bytes; blurDataUrl }>;
```

Отдельный `generateBlurDataUrl` не нужен: плейсхолдер считается конвейером из
итогового мастера, поэтому он всегда соответствует тому, что реально отдаётся.

Импорт CSV возвращает ошибки построчно и не применяет ничего частично: половина
загруженного каталога хуже, чем ничего.

---

## 12. Приватность и согласия

```ts
// src/lib/privacy/pii.ts
export function maskEmail(value: string): string;
export function maskPhone(value: string): string;
export function maskCardLast4(value: string): string;
export function redact<T extends object>(value: T, fields: readonly string[]): T;   // используется audit.ts

// src/lib/privacy/consent.ts
export function recordConsent(input: { userId: string; type: ConsentType; documentVersion: string }): Promise<void>;
export function hasValidConsent(userId: string, type: ConsentType): Promise<boolean>;
/** Версия документа изменилась → согласие нужно взять заново. */
export function consentOutdated(record: ConsentRecord): boolean;

// src/lib/privacy/export.ts
export function buildUserDataExport(userId: string): Promise<UserDataExport>;   // ЗРА, задача A-10
export function scheduleAccountDeletion(userId: string): Promise<Date>;        // dataRetention.accountDeletionGraceDays
```

---

## 13. Ранжирование и рекомендации

```ts
// src/domain/ranking.ts
export interface RankingSignals {
  averageRating: number; reviewCount: number;
  fillRate: number; responseTimeMinutes: number;
  cancellationRate: number; noShowRate: number;
  completedBookings: number; createdAt: Date;
  isVerified: boolean; boostedUntil: Date | null;
}
/** Веса — из src/config/ranking.ts. Функция чистая и покрыта тестом. */
export function computeRankingScore(signals: RankingSignals, now: Date): number;
/** Новый инструктор без отзывов не должен падать в конец: иначе он не получит первую бронь. */
export function newcomerBoost(createdAt: Date, now: Date): number;

// src/domain/recommendations.ts
export function similarClasses(base: ClassForRecommendation, pool: readonly ClassForRecommendation[], limit: number): readonly ClassForRecommendation[];
export function recommendedFor(profile: UserTasteProfile, pool: readonly ClassForRecommendation[], limit: number): readonly ClassForRecommendation[];
```

Ранжирование — денежная логика: порядок выдачи определяет, кто получит брони.
Поэтому оно живёт в `src/domain/`, тестируется и не размазывается по `ORDER BY` в
разных запросах.

---

## 14. Мелкие утилиты, без которых обходятся копипастой

```ts
// src/lib/collections.ts
export function groupBy<T, K extends string>(items: readonly T[], key: (item: T) => K): Record<K, T[]>;
export function chunk<T>(items: readonly T[], size: number): T[][];
export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[];
export function sortByOrder<T>(items: readonly T[], order: readonly string[], key: (item: T) => string): T[];

// src/lib/async.ts
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T>;
export function retry<T>(fn: () => Promise<T>, options: { attempts: number; baseDelayMs: number }): Promise<T>;
export function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]>;

// src/lib/http/problem.ts — единый формат ошибок API (RFC 9457)
export function problem(status: number, code: ErrorCode, detail?: string): Response;
export function problemFromDomainError(error: DomainError): Response;
```

`withTimeout` обязателен для всех внешних вызовов — платежи, SMS, карты, R2.
Внешний сервис, отвечающий 30 секунд, не должен держать наш запрос: у Vercel
есть свой лимит, и клиент увидит пустую ошибку вместо понятного сообщения.

`retry` не применяется к платежам: там повтор идёт только через идемпотентный
ключ, иначе можно списать дважды.

---

## 15. Порядок создания

| Когда | Модули |
|---|---|
| Задача 1.1–1.3 | `result.ts`, `format/*`, `slug.ts`, `collections.ts`, `async.ts`, `cache/tags.ts` |
| Задача 1.6–1.7 | `privacy/*`, `idempotency.ts` (обработка изображений уже готова: `lib/media/ingest.ts`) |
| Задача 2.1 | **`server/action.ts`, `server/query.ts`** — до первой мутации, иначе переписывать все |
| Задача 2.5–2.9 | `url/*`, `search/normalize.ts`, `seo/*`, `domain/ranking.ts` |
| Задача 3.1–3.3 | `time/*`, `domain/availability/*`, `domain/holidays.ts`, `domain/booking/policy.ts` |
| Задача 3.9 | `notifications/*`, `files/ics.ts` |
| Фаза 5 | `http/problem.ts`, доработка `idempotency.ts` под возвраты |
| Фаза 7 | `files/csv.ts` (импорт), `files/invoice.ts`, `analytics/*`, `experiments.ts` |

Тесты обязательны для: `time/*`, `domain/availability/*`, `domain/booking/policy.ts`,
`domain/ranking.ts`, `search/normalize.ts`, `format/phone.ts`, `url/cursor.ts`,
`files/qr.ts`. Это функции, ошибка в которых стоит денег или ломает бронирование,
и все они чистые — тест на них дешёвый.


---

## 16. Корзина (мягкое удаление) — уже написано

Перечислено здесь по назначению этого документа: чтобы вторая функция «спрятать
удалённое» не появилась рядом с первой. Всё ниже существует и покрыто тестами.

```ts
// src/config/trash.ts — что вообще участвует в корзине
export const trashedModels: readonly string[];        // 13 моделей, единственный список
export function isTrashedModel(model: string): boolean;
export function modelDelegateKey(model: string): string;   // DanceClass → danceClass
export const trash: { retentionDays: 30; purgeBatchSize: 200; pageSize: 25 };
```

```ts
// src/domain/trash.ts — чистые правила, без Prisma
export const notTrashed: { deletedAt: null };
export const onlyTrashed: { deletedAt: { not: null } };
/** Подмешивает фильтр в аргументы чтения. Вызывается расширением клиента. */
export function readArgsWithoutTrashed(model: string, operation: string, args: unknown): unknown;
export function purgeCutoff(now: Date): Date;
export function daysLeftInTrash(deletedAt: Date, now: Date): number;
```

```ts
// src/server/queries/relations.ts — вложенные связи с фильтром
export const mediaRelation;            // media: mediaRelation
export function upcomingSessionsRelation(now: Date, take: number);
export const activeRoomsRelation;
export const roomPricesRelation;
export const activeVariantsRelation;
```

```ts
// src/server/admin/trash.ts — операции над удалённым
export const trashableResources: readonly AdminResource[];
export function isTrashableResource(resource: AdminResource): boolean;
export function listTrash(resource: AdminResource, page: number): Promise<TrashPage>;
export function trashCounts(): Promise<TrashCounts>;
export function trashedSnapshot(resource: AdminResource, id: string): Promise<… | null>;
export function restoreFromTrash(resource: AdminResource, id: string): Promise<void>;
export function purgeFromTrash(resource: AdminResource, id: string): Promise<void>;
export function purgeExpiredTrash(now: Date): Promise<PurgeReport>;
```

Два правила, которые стоит знать до того, как писать запрос:

1. **Фильтр ставится сам.** Расширение клиента (`src/lib/db.ts`) добавляет
   `deletedAt: null` в любое чтение верхнего уровня. Писать его руками не нужно и
   не следует — лишнее упоминание `deletedAt` в `where` ОТКЛЮЧАЕТ подмешивание.
   Именно так и работает раздел корзины: он передаёт `onlyTrashed` явно.
2. **Вложенная связь — исключение.** До `select: { media: … }` расширения Prisma
   не доходят. Такие связи берутся из `queries/relations.ts` или несут
   `notTrashed` явно, и это проверяет `queries/relations.test.ts`, читая исходники.

Тесты обязательны: `domain/trash.ts` (подмешивание фильтра и срок хранения),
`config/trash.ts` против `schema.prisma` (колонка, индекс, частичность уникальных
ограничений). Ошибка здесь означает удалённую запись в публичном каталоге.
