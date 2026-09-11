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

import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { security, type RateLimitKey } from '@/config/business';
import { clientEnv, getServerEnv } from '@/config/env';
import { lockoutErrorCode } from '@/domain/auth';
import { locales } from '@/i18n/config';
import { db } from '@/lib/db';
import { userRoles } from '@/domain/enums';
import { clearFailures, lockoutState, recordFailure } from '@/lib/auth/lockout';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

const SECONDS_PER_DAY = 60 * 60 * 24;

const env = getServerEnv();

/**
 * Доверенные источники для проверки Origin.
 *
 * Всегда содержит собственный адрес приложения; остальное добавляется через
 * `AUTH_TRUSTED_ORIGINS` (preview-домены Vercel). Пустой список означал бы, что
 * библиотека принимает запросы с любого origin.
 */
const trustedOrigins = [
  clientEnv.NEXT_PUBLIC_APP_URL,
  ...(env.AUTH_TRUSTED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? []),
];

/**
 * Google подключается только когда задана пара ключей.
 *
 * Половина конфигурации хуже, чем её отсутствие: библиотека объявила бы провайдера
 * и отдала кнопку «Войти через Google», которая ведёт на ошибку обмена токена.
 */
const socialProviders =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : {};

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
          const limit = await checkRateLimit(operation, clientIdentifier(ctx.headers ?? new Headers()));
          if (!limit.allowed) {
            throw new APIError('TOO_MANY_REQUESTS', {
              code: 'RATE_LIMITED',
              message: `Rate limit ${operation}: retry after ${limit.retryAfterSeconds}s`,
              retryAfterSeconds: limit.retryAfterSeconds,
            });
          }
        }
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

      /* Успех обнуляет счётчик: серия неудач до правильного пароля — не атака. */
      await clearFailures(email);
    }),
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
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
