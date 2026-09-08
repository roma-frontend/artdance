'use server';

/**
 * ВХОД, РЕГИСТРАЦИЯ, СБРОС ПАРОЛЯ.
 *
 * Тонкая обёртка над Better Auth: сама аутентификация — её работа, здесь только
 * то, чего библиотека не знает.
 *
 * ## Что добавляет этот слой
 *
 * **Отказ до лишней работы при блокировке.** Само правило «пять неудач — четверть
 * часа тишины» применяется в хуке библиотеки (`lib/auth/auth.ts`): только там
 * проходят оба пути входа — форма и публичный `/api/auth/sign-in/email`. Здесь
 * состояние проверяется первым, чтобы не звать капчу и не считать хеш пароля для
 * заблокированного аккаунта.
 *
 * **Капчу.** `security.captchaProtectedActions` перечисляет `signIn`, `signUp` и
 * `passwordReset`. Пока ключи Cloudflare не заданы, проверка пропускает — форма
 * работает, и в коде не остаётся закомментированных вызовов.
 *
 * **Единый формат ошибок.** Наружу уходит код и ключ i18n, а не текст библиотеки:
 * «Invalid email or password» на армянской странице — единственная английская
 * строка на экране, и переводу она не поддаётся.
 *
 * ## Три решения о том, что показывать
 *
 * **Вход не различает «нет такого адреса» и «неверный пароль».** Разные ответы
 * превращают форму в способ проверить, зарегистрирован ли человек: для
 * маркетплейса это утечка клиентской базы, а для конкретного человека — факт,
 * который он не выбирал раскрывать.
 *
 * **Блокировка считается и для несуществующего адреса.** Иначе разница в ответах
 * («заблокировано» против «неверные данные») возвращает то самое перечисление,
 * которое закрывает предыдущий пункт.
 *
 * **Сброс пароля всегда отвечает успехом.** «Письмо отправлено» и для
 * зарегистрированного адреса, и для выдуманного: текст в i18n сформулирован так,
 * что не обещает лишнего («если аккаунт существует, ссылка уже в пути»).
 *
 * ## Чего здесь нет
 *
 * Установки cookie руками. Её делает плагин `nextCookies` внутри библиотеки;
 * ручная работа с `Set-Cookie` рядом с ней означала бы два места, где решается
 * срок жизни сессии.
 */

import { APIError } from 'better-auth/api';
import { headers } from 'next/headers';

import { absoluteUrl } from '@/config/site';
import { routes } from '@/config/routes';
import { domainErrors } from '@/domain/errors';
import {
  forgotPasswordSchema,
  lockoutErrorCode,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/domain/auth';
import { auth } from '@/lib/auth/auth';
import { lockoutState } from '@/lib/auth/lockout';
import { assertCaptcha, publicAction } from '@/server/safe-action';

/**
 * Остаток блокировки из тела ошибки библиотеки.
 *
 * Число приходит из нашего же хука, но проходит через слой библиотеки, где тип
 * теряется. Ноль как запасной вариант честнее выдуманной цифры: сообщение
 * скажет «попробуйте позже», а не «через 15 минут», которых никто не считал.
 */
function lockoutMinutesFrom(body: unknown): number {
  if (typeof body !== 'object' || body === null) return 0;
  const value = (body as { remainingMinutes?: unknown }).remainingMinutes;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Куда вести после успешного входа.
 *
 * `redirectTo` уже проверен схемой на относительность, но проверяется снова:
 * значение приходит из адресной строки, и открытый редирект с нашего домена — это
 * готовая фишинговая ссылка. Дважды проверить строку дешевле, чем один раз
 * объясняться.
 */
function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return routes.account();
  return target;
}

/**
 * Вход по адресу и паролю.
 *
 * Блокировка проверяется здесь ДО капчи — но применяется не здесь. Единственная
 * точка применения — хук в `lib/auth/auth.ts`, потому что `/api/auth/sign-in/email`
 * достижим напрямую и действие в этом пути не участвует. Проверка в начале
 * действия оставлена как отказ до лишней работы: проверять капчу (сетевой вызов к
 * Cloudflare) и пароль у заблокированного аккаунта значит выполнять работу,
 * которую заказала атака.
 *
 * Счётчик неудач ведёт хук, поэтому здесь его нет: два места учёта дали бы две
 * попытки за одну.
 */
export const signInAction = publicAction
  .metadata({ rateLimit: 'signIn', audit: 'auth.signIn' })
  .inputSchema(signInSchema)
  .action(async ({ parsedInput, ctx }) => {
    const lock = await lockoutState(parsedInput.email);
    if (lock.locked) throw domainErrors.tooManyAttempts(lock.remainingMinutes);

    await assertCaptcha(parsedInput.captchaToken, ctx.identifier);

    try {
      await auth.api.signInEmail({
        body: { email: parsedInput.email, password: parsedInput.password },
        headers: await headers(),
      });
    } catch (error) {
      if (error instanceof APIError) {
        /*
         * Блокировка пришла из хука вместе с остатком времени — её нельзя
         * показать как «неверные данные»: человек, забывший пароль, должен
         * понимать, что ждать четверть часа, а не пробовать снова.
         */
        if (error.body?.code === lockoutErrorCode) {
          throw domainErrors.tooManyAttempts(lockoutMinutesFrom(error.body));
        }

        /*
         * Неудача уже учтена хуком. Состояние перечитывается, чтобы последняя
         * допустимая попытка сразу сказала про блокировку, а не отправила
         * человека на ещё один заведомо отклонённый заход.
         */
        const after = await lockoutState(parsedInput.email);
        if (after.locked) throw domainErrors.tooManyAttempts(after.remainingMinutes);
        throw domainErrors.invalidCredentials();
      }
      throw error;
    }

    return { redirectTo: safeRedirect(parsedInput.redirectTo) };
  });

/**
 * Регистрация.
 *
 * `role` в теле запроса невозможен: поле объявлено с `input: false` в
 * конфигурации Better Auth, и попытка его прислать отклоняется библиотекой. Здесь
 * это не проверяется повторно намеренно — вторая проверка создала бы иллюзию, что
 * первой можно не быть.
 *
 * Занятый адрес — единственный случай, когда ответ раскрывает существование
 * аккаунта, и это неизбежно: не сказать «адрес занят» значит либо молча не
 * зарегистрировать человека, либо создать второй аккаунт на тот же адрес.
 */
export const signUpAction = publicAction
  .metadata({ rateLimit: 'signUp', audit: 'auth.signUp' })
  .inputSchema(signUpSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCaptcha(parsedInput.captchaToken, ctx.identifier);

    try {
      await auth.api.signUpEmail({
        body: {
          email: parsedInput.email,
          password: parsedInput.password,
          name: parsedInput.name,
        },
        headers: await headers(),
      });
    } catch (error) {
      if (error instanceof APIError) {
        /*
         * Библиотека различает «адрес занят» кодом ошибки, а не текстом: разбор
         * сообщения сломался бы при первой смене формулировки. Сравнение по
         * началу строки — потому что код уточняется от версии к версии
         * (`USER_ALREADY_EXISTS` → `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`), а
         * смысл остаётся тот же. Всё непонятное отвечает общей ошибкой, а не
         * «адрес занят»: ложное «занят» отправляет человека восстанавливать
         * пароль к аккаунту, которого нет.
         */
        const code = error.body?.code ?? '';
        if (code.startsWith('USER_ALREADY_EXISTS')) throw domainErrors.emailTaken();
        throw domainErrors.invalidCredentials();
      }
      throw error;
    }

    return { redirectTo: safeRedirect(parsedInput.redirectTo) };
  });

/**
 * Запрос ссылки для сброса пароля.
 *
 * Отвечает успехом всегда — см. шапку. Письмо уходит через
 * `lib/email/send.ts`; пока `RESEND_API_KEY` не задан, отправки нет, и это видно
 * в отчёте окружения, а не в тишине.
 */
export const forgotPasswordAction = publicAction
  .metadata({ rateLimit: 'passwordReset', audit: 'auth.passwordReset' })
  .inputSchema(forgotPasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCaptcha(parsedInput.captchaToken, ctx.identifier);

    try {
      await auth.api.requestPasswordReset({
        body: {
          email: parsedInput.email,
          /* Ссылка ведёт на наш экран; токен библиотека добавит в query. */
          redirectTo: absoluteUrl(routes.resetPassword()),
        },
        headers: await headers(),
      });
    } catch (error) {
      /*
       * Отказ не показывается: он почти всегда означает «такого адреса нет», а
       * это ровно тот факт, который мы не раскрываем. В логи — целиком.
       */
      if (!(error instanceof APIError)) throw error;
      console.warn('[auth] requestPasswordReset', error.body?.code ?? error.message);
    }

    return { sent: true };
  });

/** Установка нового пароля по токену из письма. */
export const resetPasswordAction = publicAction
  .metadata({ rateLimit: 'passwordReset', audit: 'auth.resetPassword' })
  .inputSchema(resetPasswordSchema)
  .action(async ({ parsedInput }) => {
    try {
      await auth.api.resetPassword({
        body: { newPassword: parsedInput.password, token: parsedInput.token },
        headers: await headers(),
      });
    } catch (error) {
      if (error instanceof APIError) throw domainErrors.invalidResetToken();
      throw error;
    }

    return { updated: true };
  });

/**
 * Выход.
 *
 * Отдельным действием, а не ссылкой на эндпоинт библиотеки: выход — мутация, и
 * ссылка на неё срабатывает от превью в мессенджере и от префетча браузера.
 */
export const signOutAction = publicAction
  .metadata({ rateLimit: 'signIn', audit: 'auth.signOut' })
  .action(async () => {
    await auth.api.signOut({ headers: await headers() });
    return { signedOut: true };
  });
