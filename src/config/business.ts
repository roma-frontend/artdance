/**
 * BUSINESS RULES — все числовые и временные правила платформы в одном месте.
 *
 * Каждое значение здесь — коммерческое решение, а не деталь реализации.
 * Ни одна из этих цифр не должна появиться в компоненте, server action или
 * миграции литералом. Изменение правила отмены = правка одной строки.
 *
 * Значения-заготовки взяты из утверждённого прототипа (`final.html`) и требуют
 * финального подтверждения заказчиком — отмечены `@confirm`.
 */

import { site } from './site';

/* ────────────────────────────── ВАЛЮТА ────────────────────────────── */

export const currency = {
  code: 'AMD',
  symbol: '֏',
  /** У драма нет разменной единицы в обороте → храним целые единицы. */
  decimals: 0,
  minorUnitsPerUnit: 1,
  /** Кратность округления цен в каталоге (100 ֏). */
  roundingStep: 100,
  /** Валюты, в которых допустимо *показывать* цену (конвертация только визуальная). */
  displayCurrencies: ['AMD', 'USD', 'EUR', 'RUB'],
  baseCurrency: 'AMD',
} as const;

/* ────────────────────────────── НАЛОГИ ────────────────────────────── */

export const tax = {
  /** НДС РА. @confirm — зависит от режима налогообложения заказчика. */
  vatRate: 0.2,
  /** Цены в каталоге указываются с НДС (b2c-норма для РА). */
  pricesIncludeVat: true,
  /** Порог оборота, после которого требуется НДС-регистрация. @confirm с бухгалтером. */
  vatRegistrationThreshold: 115_000_000,
  invoiceNumberPrefix: 'AD',
} as const;

/* ──────────────────────────── БРОНИРОВАНИЕ ──────────────────────────── */

export const booking = {
  /** Сетка слотов в минутах. Всё расписание кратно этому значению. */
  slotGranularityMinutes: 30,
  /** Допустимые длительности занятий. */
  durationsMinutes: [45, 60, 90, 120],
  defaultDurationMinutes: 60,
  /** Технический буфер между бронями одного ресурса (переодеться/проветрить). */
  bufferBetweenBookingsMinutes: 15,

  /** Минимум «за сколько» можно забронировать. */
  minLeadTimeMinutes: 120,
  /** Горизонт бронирования вперёд. */
  maxAdvanceDays: 90,

  /** Слот блокируется на время оформления оплаты; по истечении освобождается. */
  holdTtlMinutes: 15,
  /** Сколько раз клиент может продлить hold. */
  holdMaxExtensions: 1,

  /** Бесплатная отмена — окно до начала. @confirm (в прототипе: 24 ч). */
  freeCancellationHours: 24,
  /** Отмена позже окна: удержание в процентах от суммы. */
  lateCancellationFeeRate: 0.5,
  /** Неявка без отмены. */
  noShowFeeRate: 1,
  /** Перенос без штрафа — окно до начала. */
  freeRescheduleHours: 12,
  maxReschedulesPerBooking: 2,

  /** Автоотмена неоплаченной брони. */
  unpaidExpiryMinutes: 30,
  /** Автоперевод в `COMPLETED` после окончания, если инструктор не отметил. */
  autoCompleteAfterHours: 12,

  /** Лист ожидания при заполненной группе. */
  waitlistEnabled: true,
  waitlistMaxSize: 20,
  /** Сколько времени у первого в листе на подтверждение освободившегося места. */
  waitlistClaimWindowMinutes: 120,

  /** Одновременных активных броней на клиента (антиабуз). */
  maxActiveBookingsPerCustomer: 10,

  /** Выезд инструктора к клиенту. @confirm (в прототипе: 5 000 ֏). */
  travelFee: 5_000,
  travelRadiusKm: 15,

  /** Напоминания до начала, в часах. */
  reminderOffsetsHours: [24, 2],
} as const;

export const bookingLocationOptions = ['STUDIO', 'CUSTOMER_LOCATION', 'ONLINE'] as const;
export type BookingLocationOption = (typeof bookingLocationOptions)[number];

/* ───────────────────────── АРЕНДА ПЛОЩАДОК ───────────────────────── */

export const venue = {
  minRentalMinutes: 60,
  maxRentalMinutes: 480,
  rentalGranularityMinutes: 30,
  /** Депозит при аренде зала — доля от суммы. 0 = отключено. */
  depositRate: 0,
  freeCancellationHours: 48,
  /** Дни, когда площадка недоступна по умолчанию (0 = воскресенье). */
  defaultClosedWeekdays: [] as number[],
  operatingHours: site.operatingHours,
} as const;

/* ───────────────────────────── КОМИССИИ ───────────────────────────── */

/**
 * Модель монетизации маркетплейса. Даже если в первом релизе выплаты
 * исполнителям ведутся вручную, ставки фиксируются здесь с самого начала —
 * это снимает необходимость переписывать расчёты позже.
 */
export const commission = {
  /** Комиссия платформы с занятия инструктора. @confirm */
  instructorRate: 0.15,
  /** Комиссия с аренды зала. @confirm */
  venueRate: 0.12,
  /** Товары платформы — комиссия не применяется (маржа своя). */
  ownProductRate: 0,
  /** Товары сторонних продавцов. */
  marketplaceProductRate: 0.1,
  /** Билеты на события. */
  eventRate: 0.1,
  /** Минимальная комиссия за транзакцию. */
  minimumFee: 300,
  /** Кто платит эквайринг: PLATFORM | PROVIDER (исполнитель) | SPLIT. */
  acquiringFeeBearer: 'PLATFORM',
} as const;

export const payout = {
  /** Периодичность выплат исполнителям. */
  schedule: 'WEEKLY',
  /** День недели для запуска выплат (1 = понедельник). */
  weekday: 2,
  /** Минимальная сумма к выплате; ниже — переносится на следующий период. */
  minimumAmount: 20_000,
  /** Задержка после завершения занятия до включения в выплату (окно на спор). */
  holdbackDays: 3,
  supportedMethods: ['BANK_TRANSFER', 'CARD_TRANSFER'] as const,
} as const;

/* ──────────────────────────── E-COMMERCE ──────────────────────────── */

export const commerce = {
  /** Бесплатная доставка от суммы. @confirm */
  freeDeliveryThreshold: 25_000,
  deliveryFee: {
    yerevan: 1_500,
    regions: 3_000,
    pickup: 0,
  },
  deliveryEstimateDays: {
    yerevan: { min: 1, max: 2 },
    regions: { min: 2, max: 4 },
  },
  /** Возврат товара. */
  returnWindowDays: 14,
  /** Сколько единиц одного товара можно положить в корзину. */
  maxQuantityPerItem: 10,
  maxCartItems: 50,
  /** Резерв товара в корзине (минуты). 0 = не резервируем. */
  cartReservationMinutes: 0,
  /** Порог «осталось мало» для бейджа в карточке. */
  lowStockThreshold: 5,
  /** Разрешить заказ при нулевом остатке. */
  allowBackorder: false,
  orderNumberPrefix: 'AD',
  orderNumberLength: 8,
} as const;

/* ───────────────────────────── ПРОМОКОДЫ ───────────────────────────── */

export const promotions = {
  maxCodesPerOrder: 1,
  /** Стакается ли промокод со скидкой подписки. */
  stackWithSubscription: false,
  codeMinLength: 4,
  codeMaxLength: 24,
  /** Дефолтный welcome-код первой покупки (создаётся сидом). */
  welcomeCode: { code: 'WELCOME10', percentOff: 10 },
  giftCard: {
    minAmount: 5_000,
    maxAmount: 500_000,
    amountStep: 5_000,
    validityMonths: 12,
    presetAmounts: [5_000, 10_000, 20_000, 50_000],
  },
} as const;

/* ────────────────────────────── ОТЗЫВЫ ────────────────────────────── */

export const reviews = {
  minRating: 1,
  maxRating: 5,
  /** Отзыв доступен только после посещённого занятия/полученного заказа. */
  requireVerifiedPurchase: true,
  /** Окно на публикацию отзыва после завершения. */
  windowDays: 30,
  minLength: 20,
  maxLength: 2_000,
  /** Премодерация до публикации. */
  requireModeration: true,
  /** Сколько отзывов нужно, чтобы показывать средний рейтинг. */
  minCountToDisplayAverage: 3,
  allowEditWithinHours: 24,
} as const;

/* ─────────────────────── ЛИМИТЫ И БЕЗОПАСНОСТЬ ─────────────────────── */

export const limits = {
  pagination: {
    defaultPageSize: 24,
    maxPageSize: 96,
    /** Размер порции для бесконечной прокрутки в каталоге. */
    infiniteScrollBatch: 12,
  },
  search: {
    minQueryLength: 2,
    maxQueryLength: 120,
    debounceMs: 250,
    maxSuggestions: 8,
    /**
     * Сколько направлений показывать в поиске до ввода запроса.
     *
     * Меньше, чем `maxSuggestions`, и это не описка: подсказки при вводе — это
     * ответ на вопрос, и восемь строк там уместны, а список «популярное» стоит на
     * пустом экране и обязан умещаться целиком. Полоса прокрутки в полноэкранном
     * поиске сразу после открытия читается как «здесь ещё что-то есть», хотя
     * дальше только продолжение того же списка.
     */
    popularCount: 5,
  },
  upload: {
    maxImageBytes: 8 * 1024 * 1024,
    maxAvatarBytes: 2 * 1024 * 1024,
    maxVideoBytes: 512 * 1024 * 1024,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime'],
    maxImagesPerEntity: 12,
  },
  text: {
    nameMax: 80,
    bioMax: 2_000,
    titleMax: 120,
    descriptionMax: 5_000,
    messageMax: 2_000,
    addressMax: 240,
  },
} as const;

/**
 * Rate limits: `{ requests, windowSeconds }`. Ключ = логическая операция,
 * а не URL, чтобы лимит выживал рефакторинг роутов.
 */
export const rateLimits = {
  signIn: { requests: 8, windowSeconds: 300 },
  signUp: { requests: 5, windowSeconds: 3_600 },
  passwordReset: { requests: 3, windowSeconds: 3_600 },
  otpRequest: { requests: 5, windowSeconds: 900 },
  otpVerify: { requests: 10, windowSeconds: 900 },
  bookingHold: { requests: 20, windowSeconds: 600 },
  paymentIntent: { requests: 10, windowSeconds: 600 },
  reviewSubmit: { requests: 5, windowSeconds: 3_600 },
  contactForm: { requests: 3, windowSeconds: 3_600 },
  search: { requests: 120, windowSeconds: 60 },
  mediaUpload: { requests: 30, windowSeconds: 600 },
  webhook: { requests: 600, windowSeconds: 60 },
  /** Грубый backstop на весь /api: ловит флуд, а не целевую атаку. */
  apiFlood: { requests: 600, windowSeconds: 600 },
} as const;

export type RateLimitKey = keyof typeof rateLimits;

export const security = {
  password: {
    minLength: 10,
    maxLength: 128,
    requireNumber: true,
    requireUppercase: false,
    requireSymbol: false,
    /** Проверка на утечки (k-anonymity к HaveIBeenPwned). */
    checkBreached: true,
  },
  /**
   * Блокировка после серии неудачных входов. Rate limit ограничивает частоту,
   * lockout — общее число попыток: без него медленный перебор проходит под
   * лимитом бесконечно.
   */
  login: {
    maxFailures: 5,
    lockoutMinutes: 15,
    /** Счётчик неудач сбрасывается, если попыток не было столько времени. */
    failureWindowMinutes: 60,
  },
  session: {
    ttlDays: 30,
    /** Продлевать сессию, если она использована в последние N дней. */
    refreshWithinDays: 7,
    /** Максимум одновременных сессий на пользователя. */
    maxConcurrent: 10,
    /** Как часто обновлять `lastActiveAt`: иначе запись в БД на каждый запрос. */
    presenceThrottleSeconds: 60,
    cookieName: 'artdance.session_token',
  },
  otp: {
    length: 6,
    ttlSeconds: 300,
    maxAttempts: 5,
    resendCooldownSeconds: 60,
  },
  /**
   * Действия, требующие подтверждения второго администратора (maker-checker).
   * Защищает от одиночной ошибки и от скомпрометированного аккаунта.
   */
  approvalRequiredActions: [
    'payment.manualRefund',
    'payout.release',
    'user.roleChange',
    'promoCode.create',
    'booking.bulkCancel',
  ] as const,
  /** Ограничители для делегированных админов. Superadmin не ограничен. */
  guardrails: {
    maxManualDiscountPercent: 20,
    maxBulkActionItems: 100,
    /** Изменение цены сверх этого процента помечается для ревью. */
    priceChangeFlagPercent: 50,
    maxManualRefund: 200_000,
  },
  /** Turnstile обязателен на этих операциях. */
  captchaProtectedActions: [
    'signUp',
    'signIn',
    'passwordReset',
    'contactForm',
    'reviewSubmit',
    'otpRequest',
  ] as const,
  /** Роли, чьи действия пишутся в audit log всегда. */
  auditedRoles: ['ADMIN', 'SUPPORT'] as const,
  auditRetentionDays: 730,
} as const;

/* ──────────────────────── ДАННЫЕ И ПРИВАТНОСТЬ ──────────────────────── */

export const dataRetention = {
  /** ЗРА «О защите персональных данных»: удаление аккаунта — отложенное. */
  accountDeletionGraceDays: 30,
  /** Финансовые документы храним по требованию бухучёта. */
  financialRecordsYears: 5,
  inactiveAccountAnonymizeDays: 1_095,
  webhookEventRetentionDays: 90,
  analyticsRawEventRetentionDays: 180,
  uploadedMediaOrphanCleanupDays: 7,
} as const;

/* ──────────────────────────── АГРЕГАТ ──────────────────────────── */

export const businessRules = {
  currency,
  tax,
  booking,
  venue,
  commission,
  payout,
  commerce,
  promotions,
  reviews,
  limits,
  rateLimits,
  security,
  dataRetention,
} as const;

export type BusinessRules = typeof businessRules;
