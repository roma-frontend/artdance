/**
 * DOMAIN ERRORS — типизированные ошибки бизнес-логики.
 *
 * Зачем: server action должен вернуть клиенту КОД ошибки, а не готовый текст —
 * иначе сообщение нельзя перевести и нельзя обработать программно.
 * `messageKey` указывает на строку в i18n, `params` — на её плейсхолдеры.
 */

export const errorCodes = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'CAPTCHA_FAILED',
  'SLOT_UNAVAILABLE',
  'SLOT_CONFLICT',
  'HOLD_EXPIRED',
  'LEAD_TIME_VIOLATION',
  'BOOKING_HORIZON_VIOLATION',
  'CAPACITY_EXCEEDED',
  'RESCHEDULE_LIMIT_REACHED',
  'CANCELLATION_WINDOW_CLOSED',
  'OUT_OF_STOCK',
  'CART_EMPTY',
  'PROMO_INVALID',
  'PAYMENT_FAILED',
  'PAYMENT_PROVIDER_ERROR',
  'REFUND_NOT_ALLOWED',
  'REVIEW_NOT_ALLOWED',
  'REVIEW_WINDOW_CLOSED',
  'DUPLICATE_ENROLLMENT',
  'FEATURE_DISABLED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export interface DomainErrorPayload {
  code: ErrorCode;
  /** Ключ i18n для показа пользователю. */
  messageKey: string;
  /** Параметры ICU-плейсхолдеров сообщения. */
  params?: Record<string, string | number>;
  /** Поле формы, к которому относится ошибка (для react-hook-form). */
  field?: string;
  /** Технические детали — только в логи, не клиенту. */
  cause?: unknown;
}

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly messageKey: string;
  readonly params?: Record<string, string | number>;
  readonly field?: string;

  constructor(payload: DomainErrorPayload) {
    super(`${payload.code}: ${payload.messageKey}`);
    this.name = 'DomainError';
    this.code = payload.code;
    this.messageKey = payload.messageKey;
    this.params = payload.params;
    this.field = payload.field;
    if (payload.cause !== undefined) this.cause = payload.cause;
  }

  /** Безопасная для клиента сериализация: без `cause` и стека. */
  toClient(): Pick<DomainErrorPayload, 'code' | 'messageKey' | 'params' | 'field'> {
    return {
      code: this.code,
      messageKey: this.messageKey,
      ...(this.params ? { params: this.params } : {}),
      ...(this.field ? { field: this.field } : {}),
    };
  }
}

/**
 * Фабрики. Каждый бизнес-сбой создаётся именованной функцией — так список
 * возможных отказов виден целиком и каждый привязан к переводимой строке.
 */
export const domainErrors = {
  unauthorized: () =>
    new DomainError({ code: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }),

  forbidden: () => new DomainError({ code: 'FORBIDDEN', messageKey: 'errors.forbidden.description' }),

  notFound: () => new DomainError({ code: 'NOT_FOUND', messageKey: 'errors.notFound.description' }),

  rateLimited: (retryAfterSeconds: number) =>
    new DomainError({
      code: 'RATE_LIMITED',
      messageKey: 'errors.rateLimited.description',
      params: { seconds: retryAfterSeconds },
    }),

  captchaFailed: () =>
    new DomainError({ code: 'CAPTCHA_FAILED', messageKey: 'validation.captchaRequired' }),

  /**
   * Неверная пара адрес/пароль.
   *
   * Одно сообщение на оба случая — «нет такого адреса» и «пароль не тот». Разные
   * ответы превращают форму входа в способ проверить, зарегистрирован ли человек
   * на платформе; для маркетплейса это ещё и утечка клиентской базы.
   */
  invalidCredentials: () =>
    new DomainError({ code: 'UNAUTHORIZED', messageKey: 'auth.signIn.invalidCredentials' }),

  /** Аккаунт заблокирован после серии неудачных попыток входа. */
  tooManyAttempts: (minutes: number) =>
    new DomainError({
      code: 'RATE_LIMITED',
      messageKey: 'auth.signIn.tooManyAttempts',
      params: { minutes },
    }),

  /** Адрес уже занят. Показывается только при регистрации, где скрывать нечего. */
  emailTaken: () =>
    new DomainError({
      code: 'VALIDATION_FAILED',
      messageKey: 'auth.signUp.emailTaken',
      field: 'email',
    }),

  /** Ссылка сброса пароля недействительна или просрочена. */
  invalidResetToken: () =>
    new DomainError({ code: 'VALIDATION_FAILED', messageKey: 'auth.resetPassword.invalidToken' }),

  slotUnavailable: () =>
    new DomainError({ code: 'SLOT_UNAVAILABLE', messageKey: 'errors.slotUnavailable.description' }),

  slotConflict: () => new DomainError({ code: 'SLOT_CONFLICT', messageKey: 'booking.conflictError' }),

  holdExpired: () => new DomainError({ code: 'HOLD_EXPIRED', messageKey: 'booking.holdExpired' }),

  leadTimeViolation: (hours: string) =>
    new DomainError({
      code: 'LEAD_TIME_VIOLATION',
      messageKey: 'booking.leadTimeError',
      params: { hours },
    }),

  bookingHorizonViolation: (days: string) =>
    new DomainError({
      code: 'BOOKING_HORIZON_VIOLATION',
      messageKey: 'booking.horizonError',
      params: { days },
    }),

  rescheduleLimitReached: () =>
    new DomainError({ code: 'RESCHEDULE_LIMIT_REACHED', messageKey: 'booking.rescheduleLimit' }),

  /**
   * Мест меньше, чем просят. `count` — сколько осталось: «мест нет» без числа
   * заставляет человека угадывать, пройдёт ли заявка на двоих вместо трёх.
   */
  capacityExceeded: (spotsLeft: number) =>
    new DomainError({
      code: 'CAPACITY_EXCEEDED',
      messageKey: 'booking.capacityError',
      params: { count: spotsLeft },
    }),

  /** Окно бесплатной отмены закрыто, а платная для этой брони недопустима. */
  cancellationWindowClosed: () =>
    new DomainError({
      code: 'CANCELLATION_WINDOW_CLOSED',
      messageKey: 'booking.cancelForbidden',
    }),

  /** Перенос запрошен позже окна: остаётся отмена по общим правилам. */
  rescheduleWindowClosed: (hours: string) =>
    new DomainError({
      code: 'CANCELLATION_WINDOW_CLOSED',
      messageKey: 'booking.rescheduleWindowClosed',
      params: { hours },
    }),

  refundNotAllowed: () =>
    new DomainError({ code: 'REFUND_NOT_ALLOWED', messageKey: 'booking.refundNotAllowed' }),

  duplicateEnrollment: () =>
    new DomainError({ code: 'DUPLICATE_ENROLLMENT', messageKey: 'booking.duplicateEnrollment' }),

  outOfStock: (name: string) =>
    new DomainError({ code: 'OUT_OF_STOCK', messageKey: 'errors.outOfStock.description', params: { name } }),

  promoInvalid: () =>
    new DomainError({ code: 'PROMO_INVALID', messageKey: 'cart.promoInvalid', field: 'promoCode' }),

  paymentFailed: (cause?: unknown) =>
    new DomainError({
      code: 'PAYMENT_FAILED',
      messageKey: 'errors.paymentFailed.description',
      cause,
    }),

  reviewNotAllowed: () =>
    new DomainError({ code: 'REVIEW_NOT_ALLOWED', messageKey: 'reviews.onlyAfterBooking' }),

  reviewWindowClosed: () =>
    new DomainError({ code: 'REVIEW_WINDOW_CLOSED', messageKey: 'reviews.windowClosed' }),

  featureDisabled: () =>
    new DomainError({ code: 'FEATURE_DISABLED', messageKey: 'common.states.comingSoon' }),

  internal: (cause?: unknown) =>
    new DomainError({ code: 'INTERNAL', messageKey: 'errors.generic.description', cause }),
} as const;

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** HTTP-статус по коду — для Route Handlers. */
export function httpStatusFor(code: ErrorCode): number {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
    case 'FEATURE_DISABLED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'SLOT_CONFLICT':
    case 'SLOT_UNAVAILABLE':
    case 'CAPACITY_EXCEEDED':
    case 'DUPLICATE_ENROLLMENT':
    case 'OUT_OF_STOCK':
      return 409;
    case 'VALIDATION_FAILED':
    case 'CAPTCHA_FAILED':
    case 'PROMO_INVALID':
    case 'HOLD_EXPIRED':
    case 'LEAD_TIME_VIOLATION':
    case 'BOOKING_HORIZON_VIOLATION':
    case 'CANCELLATION_WINDOW_CLOSED':
    case 'RESCHEDULE_LIMIT_REACHED':
    case 'REVIEW_NOT_ALLOWED':
    case 'REVIEW_WINDOW_CLOSED':
    case 'REFUND_NOT_ALLOWED':
    case 'CART_EMPTY':
      return 422;
    case 'RATE_LIMITED':
      return 429;
    case 'PAYMENT_FAILED':
    case 'PAYMENT_PROVIDER_ERROR':
      return 502;
    default:
      return 500;
  }
}
