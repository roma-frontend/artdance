/**
 * BETTER AUTH — конфигурация аутентификации.
 *
 * Единственный экземпляр на приложение. Всё, что касается входа, живёт здесь;
 * авторизация (кто что может) — в `guards.ts` и `capabilities.ts`.
 *
 * ## Почему библиотека, а не свои двести строк
 *
 * Аутентификация выглядит простой, пока не начинаешь перечислять: хеширование
 * пароля с нормальными параметрами, ротация токена сессии, подпись cookie,
 * защита от timing-атак при проверке существования адреса, one-time токены с
 * истечением, OAuth-обмен с проверкой state и PKCE. Каждый пункт — известная
 * уязвимость, если сделать его неправильно. Библиотека уже была в зависимостях и
 * названа в плане (задача 1.7), поэтому вопрос закрыт.
 *
 * ## Три решения, которые здесь приняты
 *
 * **Имена полей схемы совпадают с ожиданиями библиотеки.** `Account`,
 * `Session.updatedAt`, `VerificationToken.value` названы так, как их ждёт Better
 * Auth. Альтернатива — пятнадцать строк сопоставления в этом файле, каждая из
 * которых однажды разойдётся со схемой. Единственное исключение — `image`:
 * в схеме это `avatarKey`, потому что в бакете лежит ключ, а не URL.
 *
 * **`role`, `locale` и `isActive` объявлены как `input: false`.** Это не
 * формальность: без этого запрос регистрации может прислать `role: 'ADMIN'`, и
 * библиотека послушно запишет его в базу. Поле, приходящее от клиента, не может
 * определять права.
 *
 * **Имя cookie — наше.** `security.session.cookieName` знают трое: библиотека,
 * `proxy.ts` (перенаправляет неаутентифицированных) и гварды. Дефолтное имя
 * библиотеки означало бы, что `proxy.ts` ищет не тот cookie и пускает всех.
 *
 * ## Чего здесь нет
 *
 * Реализации блокировки. Правило «пять неудач — четверть часа тишины» и таблица
 * `LoginAttempt` живут в `lockout.ts`; здесь только точка, где оно применяется
 * (см. `hooks` ниже).
 *
 * Отправки писем. Подтверждение адреса и сброс пароля уходят через
 * `lib/email/send.ts`; пока `RESEND_API_KEY` не задан, письма не отправляются, и
 * это видно в `npm run verify:headers` и в отчёте окружения.
 */

import 'server-only';

import { createHmac, randomBytes } from 'node:crypto';

import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { bearer, twoFactor } from 'better-auth/plugins';

import { security, type RateLimitKey } from '@/config/business';
import { clientEnv, getServerEnv } from '@/config/env';
import { isSupportOperator } from '@/config/security';
import { lockoutErrorCode } from '@/domain/auth';
import { defaultLocale, locales } from '@/i18n/config';
import { db } from '@/lib/db';
import { userRoles } from '@/domain/enums';
import { clearFailures, lockoutState, recordFailure } from '@/lib/auth/lockout';
import { notifyNewDevice } from '@/lib/auth/new-device';
import {
  deliverTwoFactorCode,
  maskedTwoFactorTarget,
  TWO_FACTOR_CODE_MINUTES,
} from '@/lib/auth/two-factor-otp';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

const SECONDS_PER_DAY = 60 * 60 * 24;

/**
 * Сколько дней браузер помнит устройство. Cookie доверия живёт до этого срока,
 * но браузер удаляет его при очистке cookie и данных сайта: поэтому «до очистки
 * кеша» — это фактическое поведение, а не обещание на 400 дней.
 */
const TRUST_DEVICE_DAYS = 400;

/** Путь библиотеки, который принимает код из письма или SMS. */
const TWO_FACTOR_VERIFY_PATHS = new Set(['/two-factor/verify-otp', '/two-factor/verify-backup-code']);

/** Последний код, отправленный в dev. Нужен только для тестового кода; в production не заполняется. */
let lastDevOtp: string | null = null;

/** Срок челленджа в секундах: совпадает с дефолтом плагина (`twoFactorCookieMaxAge`). */
const TWO_FACTOR_CHALLENGE_SECONDS = 600;

const TRUST_DEVICE_MAX_AGE_SECONDS = TRUST_DEVICE_DAYS * SECONDS_PER_DAY;

/** Имена cookie плагина без префикса: `createAuthCookie` добавит префикс приложения. */
const TWO_FACTOR_COOKIE = 'two_factor';
const TRUST_DEVICE_COOKIE = 'trust_device';

/**
 * Роли, для которых второй фактор обязателен даже при выключенном флаге.
 * Оператор, у которого флаг можно сбросить, — это оператор с одним паролем.
 */
export const secondFactorRequiredRoles: readonly string[] = ['ADMIN', 'SUPPORT'];

interface SecondFactorSubject {
  id: string;
  email: string;
  role?: string | null;
  twoFactorEnabled?: boolean | null;
}

function isSecondFactorRequired(user: SecondFactorSubject): boolean {
  if (twoFactorBypassed) return false;
  if (user.twoFactorEnabled) return true;
  return secondFactorRequiredRoles.includes(user.role ?? '') || isSupportOperator(user);
}

/** Пути социального входа: колбэк провайдера и вход по identity token с устройства. */
function isSocialSignInPath(path: string): boolean {
  return path.startsWith('/callback/') || path === '/sign-in/social';
}

/** Подпись trust-cookie: та же схема, что у плагина (HMAC-SHA256, base64url без паддинга). */
function trustSignature(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('base64url');
}

/** Тип контекста хука: берём у библиотеки, а не дублируем руками. */
type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

const env = getServerEnv();

/* Временный обход 2FA (TWO_FACTOR_TEMP_BYPASS=true) работает только вне production; в production флаг игнорируется. */
const twoFactorBypassed = env.TWO_FACTOR_TEMP_BYPASS === 'true' && env.NODE_ENV !== 'production';

/**
 * Доверенные источники для проверки Origin.
 *
 * Всегда содержит собственный адрес приложения; остальное добавляется через
 * `AUTH_TRUSTED_ORIGINS` (preview-домены Vercel). Пустой список означал бы, что
 * библиотека принимает запросы с любого origin.
 */
const devWebOrigins = env.NODE_ENV === 'production' ? [] : ['http://localhost:8081', 'http://localhost:8082'];

const appleEnabled = Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET);

const trustedOrigins = [
  clientEnv.NEXT_PUBLIC_APP_URL,
  ...(env.AUTH_TRUSTED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? []),
  ...devWebOrigins,
  // Apple возвращает ответ POST-формой со своего домена.
  ...(appleEnabled ? ['https://appleid.apple.com'] : []),
];

/**
 * Google и Apple подключаются только когда заданы все ключи.
 *
 * Половина конфигурации хуже, чем её отсутствие: библиотека объявила бы провайдера
 * и отдала кнопку «Войти через Google», которая ведёт на ошибку обмена токена.
 */
const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(appleEnabled
    ? {
        apple: {
          clientId: env.APPLE_CLIENT_ID as string,
          clientSecret: env.APPLE_CLIENT_SECRET as string,
          ...(env.APPLE_APP_BUNDLE_IDENTIFIER ? { appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER } : {}),
        },
      }
    : {}),
};

/** Какие социальные входы настроены: приложение показывает только рабочие кнопки. */
export const socialProviderFlags = { google: 'google' in socialProviders, apple: 'apple' in socialProviders } as const;

/**
 * Пути, на которых применяются наши ограничители частоты.
 *
 * Ключ — путь библиотеки, значение — логическая операция из `rateLimits`. Лимит
 * применяется только к ПРЯМЫМ HTTP-вызовам (см. `hooks.before`): вход через форму
 * идёт через server action, где лимит уже посчитан, и второй счёт превратил бы
 * восемь попыток из конфига в четыре.
 */
const rateLimitedPaths: Readonly<Record<string, RateLimitKey>> = {
  '/sign-in/email': 'signIn',
  '/sign-up/email': 'signUp',
  '/request-password-reset': 'passwordReset',
  '/reset-password': 'passwordReset',
};

const SIGN_IN_EMAIL_PATH = '/sign-in/email';

/** Адрес из тела запроса. Не доверяем типу: тело приходит снаружи. */
function bodyEmail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const value = (body as { email?: unknown }).email;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Вливает корзину гостя в аккаунт. Вызывается после успешного входа и после
 * подтверждения кода: без второго случая гость, войдя с двухфакторкой, терял бы
 * корзину молча. Ошибка не блокирует вход — корзина вторична.
 */
async function mergeGuestCartFor(headers: Headers, userId: string): Promise<void> {
  const anonymousId = headers.get('x-anonymous-id') ?? headers.get('X-Anonymous-Id');
  if (!anonymousId || anonymousId.length < 8) return;
  try {
    const { mergeGuestCart } = await import('@/server/cart/service');
    await mergeGuestCart({ userId, anonymousId });
  } catch {}
}

/** Id пользователя из успешного ответа библиотеки, если он есть. */
function userIdOf(returned: unknown): string | null {
  const userId = (returned as { user?: { id?: unknown } } | null)?.user?.id;
  return typeof userId === 'string' ? userId : null;
}

/**
 * Откладывает сессию до ввода кода. Повторяет то, что делает плагин при обычном
 * входе по паролю: сессия удаляется, создаётся челлендж и подписанный cookie.
 */
async function openTwoFactorChallenge(ctx: HookContext, userId: string): Promise<void> {
  const pending = ctx.context.newSession;
  deleteSessionCookie(ctx, true);
  if (pending) await ctx.context.internalAdapter.deleteSession(pending.session.token);
  ctx.context.setNewSession(null);

  const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE, { maxAge: TWO_FACTOR_CHALLENGE_SECONDS });
  const identifier = `2fa-${randomBytes(20).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + TWO_FACTOR_CHALLENGE_SECONDS * 1000);

  await ctx.context.internalAdapter.createVerificationValue({ value: userId, identifier, expiresAt });
  await ctx.context.internalAdapter.createVerificationValue({
    value: '0',
    identifier: `2fa-attempts-${identifier}`,
    expiresAt,
  });
  await ctx.setSignedCookie(cookie.name, identifier, ctx.context.secret, cookie.attributes);
}

/**
 * Доверенное устройство: та же проверка, что у плагина, и та же ротация токена
 * после использования. Без ротации украденный cookie работал бы весь срок жизни.
 */
async function isTrustedDevice(ctx: HookContext, userId: string): Promise<boolean> {
  const cookie = ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE, { maxAge: TRUST_DEVICE_MAX_AGE_SECONDS });
  const raw = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  if (!raw) return false;

  const [token, trustId] = raw.split('!');
  if (!token || !trustId) return false;
  if (token !== trustSignature(ctx.context.secret, `${userId}!${trustId}`)) return false;

  const record = await ctx.context.internalAdapter.findVerificationValue(trustId);
  if (!record || record.value !== userId || record.expiresAt <= new Date()) return false;

  await ctx.context.internalAdapter.deleteVerificationByIdentifier(trustId);
  const nextId = `trust-device-${randomBytes(24).toString('base64url')}`;
  const nextToken = trustSignature(ctx.context.secret, `${userId}!${nextId}`);
  await ctx.context.internalAdapter.createVerificationValue({
    value: userId,
    identifier: nextId,
    expiresAt: new Date(Date.now() + TRUST_DEVICE_MAX_AGE_SECONDS * 1000),
  });
  await ctx.setSignedCookie(cookie.name, `${nextToken}!${nextId}`, ctx.context.secret, cookie.attributes);
  return true;
}

/** true, если сессия отложена до кода. Доверенное устройство код не спрашивает. */
async function holdForSecondFactor(ctx: HookContext, user: SecondFactorSubject): Promise<boolean> {
  if (!isSecondFactorRequired(user)) return false;
  if (await isTrustedDevice(ctx, user.id)) return false;
  await openTwoFactorChallenge(ctx, user.id);
  return true;
}

/** Письмо о новом устройстве — только для сессии, которая реально открыта. */
async function alertIfNewDevice(ctx: HookContext): Promise<void> {
  const session = ctx.context.newSession;
  if (!session) return;
  await notifyNewDevice({
    userId: session.user.id,
    sessionId: session.session.id,
    userAgent: session.session.userAgent ?? null,
  });
}

/**
 * Социальный вход. Google и Apple не проходят через плагин: его хук смотрит только
 * на вход по паролю, поэтому без этой проверки второй фактор обходился бы одной
 * кнопкой «Войти через Google». Сессия откладывается так же, как при паролe.
 */
async function gateSocialSignIn(ctx: HookContext): Promise<unknown> {
  const session = ctx.context.newSession;
  if (!session) return undefined;

  if (await holdForSecondFactor(ctx, session.user)) {
    if (ctx.path.startsWith('/callback/')) {
      const locale = session.user.locale && isLocaleCode(session.user.locale) ? session.user.locale : defaultLocale;
      // Маска уже скрывает адрес или телефон; полный адрес в URL не попадает.
      const full = await ctx.context.internalAdapter.findUserById(session.user.id);
      const target = full ? maskedTwoFactorTarget(full) : '';
      const query = new URLSearchParams({ twoFactor: '1', target });
      throw ctx.redirect(`${clientEnv.NEXT_PUBLIC_APP_URL}/${locale}/sign-in?${query.toString()}`);
    }
    return ctx.json({ twoFactorRedirect: true, twoFactorMethods: ['otp'] });
  }

  await alertIfNewDevice(ctx);
  return undefined;
}

function isLocaleCode(value: string): value is (typeof locales)[number] {
  return (locales as readonly string[]).includes(value);
}

export const auth = betterAuth({
  appName: 'artdance',
  secret: env.AUTH_SECRET,
  baseURL: clientEnv.NEXT_PUBLIC_APP_URL,
  trustedOrigins,

  database: prismaAdapter(db, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    /*
     * Требования к паролю — из `security.password`, одни и те же на сервере, в
     * форме и в тексте подсказки. Верхняя граница нужна не меньше нижней: без неё
     * поле пароля становится способом заставить сервер считать хеш от мегабайта.
     */
    minPasswordLength: security.password.minLength,
    maxPasswordLength: security.password.maxLength,
    /*
     * Подтверждение адреса пока не требуется для входа: писем без
     * `RESEND_API_KEY` не будет, и требование заблокировало бы вход всем. Включается
     * вместе с настроенной почтой — тогда же появится и `sendVerificationEmail`.
     */
    requireEmailVerification: false,
    autoSignIn: true,
  },

  socialProviders,

  session: {
    modelName: 'Session',
    expiresIn: security.session.ttlDays * SECONDS_PER_DAY,
    /** Сессия продлевается, если использована в последние N дней. */
    updateAge: security.session.refreshWithinDays * SECONDS_PER_DAY,
    /*
     * Кеш сессии в cookie отключён намеренно. Он экономит запрос к базе, но
     * означает, что заблокированный пользователь продолжает работать до
     * истечения кеша: `isActive` проверяется при каждом обращении (см. `guards.ts`),
     * и кеш сделал бы эту проверку бессмысленной.
     */
    cookieCache: { enabled: false },
  },

  user: {
    modelName: 'User',
    fields: {
      /** В схеме это ключ в бакете, а не URL: публичный адрес строит приложение. */
      image: 'avatarKey',
    },
    additionalFields: {
      /*
       * `input: false` у всех трёх — граница между аутентификацией и авторизацией.
       * Роль, язык и признак активности назначает платформа, а не тело запроса
       * регистрации.
       */
      role: {
        type: userRoles as unknown as string[],
        defaultValue: 'CUSTOMER',
        required: false,
        input: false,
      },
      locale: {
        type: locales as unknown as string[],
        defaultValue: clientEnv.NEXT_PUBLIC_DEFAULT_LOCALE,
        required: false,
        input: false,
      },
      isActive: {
        type: 'boolean',
        defaultValue: true,
        required: false,
        input: false,
      },
    },
  },

  account: { modelName: 'Account' },
  verification: { modelName: 'VerificationToken' },

  /**
   * СВОЙ ОГРАНИЧИТЕЛЬ БИБЛИОТЕКИ ОТКЛЮЧЁН — ЛИМИТЫ У НАС ОДНИ.
   *
   * Включённым он отвечал 429 после трёх запросов к `/sign-in/email` и делал это
   * раньше нашей блокировки: наружу уходило «Too many requests» вместо честного
   * «аккаунт заблокирован на 15 минут», а числа из `rateLimits` не соблюдались ни
   * одним из двух счётчиков. Два механизма на один запрос — это ещё и лимит вдвое
   * меньше объявленного.
   *
   * Наш (`lib/security/rate-limit.ts`) лучше по существу: ключ — логическая
   * операция, а не путь; окна и числа берутся из конфигурации; в production
   * счётчик общий для всех инстансов (Redis), тогда как у библиотеки он в памяти
   * процесса — на serverless это означает лимит, умноженный на число инстансов.
   *
   * Остальные пути `/api/auth/*` (OAuth-колбэки, `get-session`, выход) остаются
   * под грубым backstop'ом `apiFlood` из `proxy.ts`: целевой атаки на них нет, а
   * точечный лимит для каждого — это список, который разойдётся с библиотекой при
   * первом обновлении.
   */
  rateLimit: { enabled: false },

  /**
   * ЗАЩИТА ОТ ПЕРЕБОРА ПРИМЕНЯЕТСЯ ЗДЕСЬ, А НЕ В ДЕЙСТВИИ ВХОДА.
   *
   * Причина конкретная и найденная на живой сборке: `/api/auth/sign-in/email` —
   * публичный маршрут (`app/api/auth/[...all]/route.ts`), и запрос к нему не
   * проходит ни через один server action. Пока блокировка вызывалась только из
   * действия, форма была защищена, а эндпоинт — нет: `LoginAttempt` не получал ни
   * одной строки, сколько бы паролей ни перебирали. Проверялось `verify:auth`.
   *
   * Хук — единственное место, куда попадают ОБА пути: и HTTP-запрос из браузера,
   * и вызов `auth.api.signInEmail` из действия. Логика по-прежнему в `lockout.ts`;
   * здесь только точка применения.
   *
   * **Различие прямого вызова и внутреннего — по `ctx.request`.** Он есть только
   * когда запрос пришёл через маршрут: `auth.api.*` вызывается с телом и
   * заголовками, но без объекта Request. Признак не подделать снаружи — это не
   * заголовок. Нужен он для ограничителя частоты: считать одну попытку дважды
   * (в действии и здесь) значит вдвое урезать лимит из конфига.
   *
   * **Неудачи считаются в `after`, а не в `catch` действия.** Хук `after`
   * выполняется и когда обработчик вернул ошибку (`ctx.context.returned` —
   * `APIError`), поэтому счётчик один на все пути входа.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.request) {
        const operation = rateLimitedPaths[ctx.path];
        if (operation) {
          const ip = clientIdentifier(ctx.headers ?? new Headers());
          // Офис за NAT делит один IP: общий bucket 20/300 вешает коллег.
          // Изолируем по ip:email — lockout по email (lockout.ts) остаётся
          // защитой от перебора одного аккаунта, rate limit страхует частоту.
          // Нормализуем email: case/пробелы не должны дробить bucket.
          const emailKey = operation === 'signIn' ? bodyEmail(ctx.body)?.trim().toLowerCase() : null;
          const identifier = emailKey ? `${ip}:${emailKey}` : ip;
          const limit = await checkRateLimit(operation, identifier);
          if (!limit.allowed) {
            throw new APIError('TOO_MANY_REQUESTS', {
              code: 'RATE_LIMITED',
              message: `Rate limit ${operation}: retry after ${limit.retryAfterSeconds}s`,
              retryAfterSeconds: limit.retryAfterSeconds,
            });
          }
        }
      }

      if (
        env.NODE_ENV === 'development' &&
        env.DEV_TWO_FACTOR_TEST_CODE &&
        lastDevOtp &&
        ctx.path === '/two-factor/verify-otp' &&
        (ctx.body as { code?: unknown } | undefined)?.code === env.DEV_TWO_FACTOR_TEST_CODE
      ) {
        return { context: { body: { ...ctx.body, code: lastDevOtp } } };
      }

      if (ctx.path !== SIGN_IN_EMAIL_PATH) return;

      const email = bodyEmail(ctx.body);
      if (!email) return;

      const lock = await lockoutState(email);
      if (!lock.locked) return;

      /*
       * Код и минуты уходят в теле ошибки: действие входа превращает их в
       * переводимое сообщение, а прямой вызов получает честный 429. Текст здесь
       * английский намеренно — это не UI, а протокол.
       */
      throw new APIError('TOO_MANY_REQUESTS', {
        code: lockoutErrorCode,
        message: `Account locked for ${lock.remainingMinutes} minutes`,
        remainingMinutes: lock.remainingMinutes,
      });
    }),

    after: createAuthMiddleware(async (ctx) => {
      /*
       * Код подтверждён: сессия только что создана, корзину вливаем сюда. Ошибка
       * кода сюда не попадает по смыслу — счётчик попыток ведёт сам плагин.
       */
      if (TWO_FACTOR_VERIFY_PATHS.has(ctx.path)) {
        if (isAPIError(ctx.context.returned)) return;
        const userId = userIdOf(ctx.context.returned);
        if (userId) await mergeGuestCartFor(ctx.headers ?? new Headers(), userId);
        await alertIfNewDevice(ctx);
        return;
      }

      if (isSocialSignInPath(ctx.path)) return gateSocialSignIn(ctx);

      if (ctx.path !== SIGN_IN_EMAIL_PATH) return;

      const email = bodyEmail(ctx.body);
      if (!email) return;

      /*
       * Любой отказ библиотеки — неудачная попытка, независимо от причины:
       * несуществующий адрес, неверный пароль, аккаунт без пароля (вход только
       * через Google). Считать их по-разному значит вернуть перечисление адресов.
       */
      if (isAPIError(ctx.context.returned)) {
        await recordFailure(email);
        return;
      }

      /*
       * Пароль верный. Счётчик неудач обнуляем уже здесь: двухфакторка имеет свой
       * счётчик (`accountLockout` плагина), и пароль, угаданный злоумышленником,
       * не должен сбрасывать его за кодом.
       */
      await clearFailures(email);

      /*
       * Оператор с выключенным флагом проходит здесь: без этой ветки флаг стал бы
       * обходом. Пользователям с флагом плагин откладывает сессию сам, но уже ПОСЛЕ
       * этого хука. Поэтому сессия у них ещё есть, и выход ниже нужен явно: иначе
       * корзина влилась бы в аккаунт до ввода кода. trust-cookie при этом не
       * ротируется дважды, потому что `holdForSecondFactor` здесь не вызывается.
       */
      const session = ctx.context.newSession;
      if (session && !session.user.twoFactorEnabled) {
        if (await holdForSecondFactor(ctx, session.user)) {
          return ctx.json({ twoFactorRedirect: true, twoFactorMethods: ['otp'] });
        }
        await alertIfNewDevice(ctx);
      }

      /*
       * Корзину вливаем только в завершённый вход. Для пользователя с фактором
       * вход завершит подтверждение кода, там же будет и слияние.
       */
      if (!session || session.user.twoFactorEnabled) return;
      const userId = userIdOf(ctx.context.returned);
      if (userId) await mergeGuestCartFor(ctx.headers ?? new Headers(), userId);
    }),
  },

  /*
   * Реферал привязывается при регистрации. Ошибка здесь не должна отменить регистрацию,
   * поэтому всё обёрнуто в try/catch. Модуль грузится лениво, как `mergeGuestCartFor`:
   * он тянет базу и сервисы, а `auth` собирается при загрузке приложения.
   */
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const { bindReferralFromCookie } = await import('@/server/referral/signup');
            await bindReferralFromCookie(user.id);
          } catch (error) {
            console.warn('[referral] signup hook failed', error);
          }
        },
      },
    },
  },

  advanced: {
    cookiePrefix: 'artdance',
    cookies: {
      /*
       * Имя целиком, а не префикс: `proxy.ts` и гварды знают его из
       * `security.session.cookieName`, и оно обязано совпадать буквально.
       *
       * Здесь именно БАЗОВОЕ имя, без `__Secure-`: префикс библиотека добавляет
       * сама, когда помечает cookie `Secure`. Имя, которое в итоге приходит в
       * запросе, объявлено рядом — `security.session.requestCookieName`.
       */
      session_token: { name: security.session.cookieName },
    },
    /**
     * Cookie только по HTTPS. Признак — адрес приложения, а не название
     * окружения; объявлен в `security.session.secureCookies` вместе с именем
     * cookie, потому что от одного признака зависит и флаг, и префикс имени.
     */
    useSecureCookies: security.session.secureCookies,
    database: {
      /** id генерирует Prisma (cuid): один способ на всю схему. */
      generateId: false,
    },
  },

  /*
   * `nextCookies` позволяет ставить cookie из server action: без него вход через
   * действие проходил бы успешно, но сессия не сохранялась — самый непонятный из
   * возможных дефектов, потому что ошибки нет ни в логах, ни в ответе.
   *
   * Плагин обязан быть последним в списке: он перехватывает ответ после всех
   * остальных хуков.
   */
  plugins: [
    bearer(),
    /*
     * ДВУХФАКТОРНАЯ ЗАЩИТА. Каждый вход требует код из письма (или SMS, когда он
     * будет настроен). Код выбирает плагин; доставку делает `deliverTwoFactorCode`.
     *
     * Хеш кода в базе, а не открытый текст: утечка таблицы `VerificationToken` не
     * даёт готовых кодов. Срок и число попыток — дефолты плагина: 3 минуты и
     * блокировка на 15 минут после 10 неверных кодов (`accountLockout`).
     *
     * Доверие устройству: после подтверждения браузер не спрашивает код, пока не
     * очищены cookie. Мобильное приложение хранит cookie в защищённом хранилище.
     */
    ...(twoFactorBypassed ? [] : [twoFactor({
      otpOptions: {
        period: TWO_FACTOR_CODE_MINUTES,
        digits: 6,
        storeOTP: 'hashed',
        sendOTP: async ({ user, otp }) => {
          const delivery = await deliverTwoFactorCode(user, otp);
          if (env.NODE_ENV === 'development') lastDevOtp = otp;
          /*
           * В production без провайдера письмо не уходит, а код остаётся в базе.
           * Молчаливый успех оставлял бы человека на шаге кода без единого символа —
           * поэтому ошибка видна в интерфейсе. В базе лежит только хеш кода.
           */
          if (!delivery.delivered && env.NODE_ENV === 'production') {
            throw new APIError('SERVICE_UNAVAILABLE', {
              code: 'TWO_FACTOR_DELIVERY_FAILED',
              message: 'Two-factor code could not be delivered',
            });
          }
          if (!delivery.delivered && env.NODE_ENV === 'development') {
            // Только локально: без RESEND_API_KEY код иначе нигде не виден.
            console.info('[2fa] провайдер не настроен, код для', user.email, 'это', otp);
          }
        },
      },
      trustDeviceMaxAge: TRUST_DEVICE_DAYS * SECONDS_PER_DAY,
    })]),
    /*
     * `nextCookies` обязан быть последним: он перехватывает ответ после всех
     * остальных плагинов и хуков.
     */
    nextCookies(),
  ],
});

export type Auth = typeof auth;
