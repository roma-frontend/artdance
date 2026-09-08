/**
 * SAFE ACTION — единственный способ объявить server action в проекте.
 *
 * Каждый `'use server'` экспорт — публичный HTTP-эндпоинт: его можно вызвать
 * curl'ом, минуя интерфейс. Значит, у каждого обязаны быть проверка входа,
 * ограничение частоты и предсказуемая ошибка на выходе. Повторять эти три вещи
 * в тридцати файлах — гарантированно забыть в одном, и именно он окажется тем,
 * который создаёт бронь.
 *
 * Поэтому клиентов ровно три, и они отличаются только уровнем доступа:
 *
 *   • `publicAction`    — вход не нужен (подписка, поиск, контактная форма);
 *   • `authedAction`    — нужна сессия, в контексте лежит `caller`;
 *   • `capabilityAction`— нужно конкретное право (админка).
 *
 * Метаданные обязательны у каждого действия: в них указывается ключ лимита из
 * `rateLimits` и, при необходимости, имя для журнала аудита. Обязательность
 * обеспечена типами — `.action()` не компилируется без `.metadata()`.
 *
 * Ошибки наружу уходят кодом и ключом i18n (`DomainError.toClient`), а не
 * текстом: сообщение обязано переводиться, а клиент — уметь отличить «слот
 * занят» от «истекло удержание» программно, а не разбором строки.
 */

import 'server-only';

import { headers } from 'next/headers';
import { createSafeActionClient, returnValidationErrors } from 'next-safe-action';
import { z } from 'zod';

import { rateLimits, type RateLimitKey } from '@/config/business';
import type { Capability } from '@/config/capabilities';
import { isProduction } from '@/config/env';
import { domainErrors, isDomainError, type DomainError } from '@/domain/errors';
import { requireCapability, requireCaller, type Caller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import type { UserRole } from '@/domain/enums';

const rateLimitKeys = Object.keys(rateLimits) as [RateLimitKey, ...RateLimitKey[]];

/**
 * Метаданные действия.
 *
 * `rateLimit` — логическая операция, а не путь: лимит должен выживать
 * переименование маршрута. `audit` — имя события для `AuditLog`; указывается у
 * всего, что меняет чужие данные или деньги.
 */
const metadataSchema = z.object({
  rateLimit: z.enum(rateLimitKeys),
  audit: z.string().optional(),
});

/**
 * Клиентская форма ошибки.
 *
 * Строка не годится: клиенту нужен код для ветвления и ключ для перевода.
 * Технические детали (`cause`, стек) сюда не попадают никогда — это прямой
 * канал наружу.
 */
export interface ActionError {
  code: DomainError['code'];
  messageKey: string;
  params?: Record<string, string | number>;
  field?: string;
}

function handleServerError(error: Error): ActionError {
  if (isDomainError(error)) {
    /** Причину логируем, наружу не отдаём. */
    if (error.cause !== undefined) console.error('[action]', error.code, error.cause);
    return error.toClient();
  }

  /*
   * Незапланированная ошибка. В логи — целиком, клиенту — общий текст: сообщение
   * Prisma об отсутствующем столбце рассказывает атакующему о схеме больше, чем
   * нужно.
   */
  console.error('[action] необработанная ошибка', error);
  if (!isProduction) {
    return { code: 'INTERNAL', messageKey: 'errors.generic.description', params: { detail: error.message } };
  }
  return domainErrors.internal().toClient();
}

/**
 * Базовый клиент: ограничение частоты и контекст запроса.
 *
 * Лимит применяется ДО валидации входа: разбор тела запроса — это работа, и
 * заставлять сервер делать её на каждом из тысячи запросов подбора значит
 * оплачивать атаку.
 */
const baseClient = createSafeActionClient({
  defineMetadataSchema: () => metadataSchema,
  handleServerError,
}).use(async ({ next, metadata }) => {
  const requestHeaders = await headers();
  const identifier = clientIdentifier(requestHeaders);

  const limit = await checkRateLimit(metadata.rateLimit, identifier);
  if (!limit.allowed) throw domainErrors.rateLimited(limit.retryAfterSeconds);

  return next({ ctx: { identifier, requestHeaders } });
});

/** Действие без входа: подписка, поиск, контактная форма, проверка промокода. */
export const publicAction = baseClient;

/**
 * Действие с сессией.
 *
 * `caller` в контексте — единственный источник личности. `userId` в аргументах
 * действия остаётся пожеланием клиента и в расчёт не берётся.
 */
export const authedAction = baseClient.use(async ({ next }) => {
  const caller = await requireCaller();
  return next({ ctx: { caller } });
});

/** Действие, требующее роль не ниже указанной. */
export function roleAction(minimum: UserRole) {
  return baseClient.use(async ({ next }) => {
    const { requireRole } = await import('@/lib/auth/guards');
    const caller = await requireRole(minimum);
    return next({ ctx: { caller } });
  });
}

/** Действие, требующее конкретное право. Основной клиент админки. */
export function capabilityAction(capability: Capability) {
  return baseClient.use(async ({ next }) => {
    const caller = await requireCapability(capability);
    return next({ ctx: { caller } });
  });
}

export type { Caller };

/* ─────────────────────────── Общие помощники ─────────────────────────── */

/**
 * Проверка капчи.
 *
 * Отдельным вызовом внутри действия, а не middleware: токен приходит в теле
 * запроса, а middleware выполняется до разбора тела. Явный вызов первой строкой
 * действия виден на ревью — молчаливый пропуск через конфиг не виден.
 *
 * Обязательна для операций из `security.captchaProtectedActions`.
 */
export async function assertCaptcha(token: string | null | undefined, remoteIp?: string): Promise<void> {
  const verdict = await verifyTurnstile(token, remoteIp);
  if (!verdict) throw domainErrors.captchaFailed();
}

/**
 * Ошибка на конкретном поле формы.
 *
 * Реэкспорт из библиотеки, чтобы действия не импортировали её напрямую: у
 * проекта одна точка входа в слой действий, и заменить библиотеку можно правкой
 * этого файла.
 */
export { returnValidationErrors };
