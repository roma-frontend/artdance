/**
 * GUARDS — единый контракт авторизации для server actions и route handlers.
 *
 * Правила, которые этот модуль делает обязательными:
 *
 * 1. **Личность берётся только из серверной сессии, никогда из аргументов.**
 *    `userId` в параметрах запроса — это не идентификация, а пожелание клиента.
 * 2. **Каждый `'use server'` экспорт — публичный HTTP-эндпоинт.** Отсутствие
 *    вызова гварда в начале action означает открытый доступ.
 * 3. **Деактивированный пользователь теряет доступ немедленно**, даже с валидной
 *    сессией: проверка `isActive` идёт при каждом обращении, а не при логине.
 * 4. `proxy.ts` только перенаправляет на страницу входа. Настоящая проверка —
 *    здесь: cookie можно подделать, серверную проверку — нет.
 *
 * **Сессию проверяет библиотека, а не запрос к таблице.** Значение cookie — это
 * токен и его подпись, а не первичный ключ: прямой `findUnique({ where: { token } })`
 * не нашёл бы ничего, а если бы нашёл — пропустил бы неподписанное значение,
 * подставленное вручную. `auth.api.getSession` сверяет подпись, срок и
 * существование записи одним вызовом.
 */

import 'server-only';

import { headers } from 'next/headers';

import type { Capability } from '@/config/capabilities';
import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { hasAtLeastRole, isUserRole, type UserRole } from '@/domain/enums';
import { isLocale, type Locale } from '@/i18n/config';
import { isSupportOperator, isSupportOwner } from '@/config/security';

import { auth } from './auth';

export interface Caller {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locale: Locale;
  supportOwner?: boolean;
  impersonator?: { id: string; email: string; role: UserRole };
}

/**
 * Текущий пользователь или `null`. Возвращает `null` вместо исключения, потому
 * что публичные страницы легально вызывают это для персонализации.
 *
 * `role` и `locale` приходят в сессии как дополнительные поля пользователя, но
 * проверяются заново: значение из базы может оказаться строкой, которой больше нет
 * в словаре (переименовали роль, забыли миграцию данных), и молча пропустить её
 * значит получить пользователя с несуществующими правами.
 */
export async function getCaller(options: { realActor?: boolean } = {}): Promise<Caller | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // Re-read authorization fields: revocation must apply even if the auth
  // library deduplicates its session read within the current request.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, emailVerified: true, name: true, role: true, locale: true, isActive: true },
  });
  if (!user) return null;
  /** Блокировка вступает в силу мгновенно, не дожидаясь истечения сессии. */
  if (user.isActive === false) return null;

  const storedRole: UserRole = isUserRole(user.role) ? user.role : 'CUSTOMER';
  const owner = isSupportOwner(user);
  const operator = isSupportOperator(user);
  const role: UserRole = operator ? 'SUPPORT' : storedRole;
  const locale: Locale = typeof user.locale === 'string' && isLocale(user.locale) ? user.locale : 'hy';

  const caller: Caller = { id: user.id, email: user.email, name: user.name, role, locale, supportOwner: owner };
  if (options.realActor || !operator) return caller;

  const row = await db.operatorSetting.findUnique({ where: { key: `impersonation.${session.session.id}` } });
  const value = row?.value as { userId?: string; expiresAt?: number } | undefined;
  if (typeof value?.userId !== 'string' || typeof value.expiresAt !== 'number' || value.expiresAt <= Date.now()) return caller;
  const target = await db.user.findUnique({ where: { id: value.userId }, select: { id: true, email: true, name: true, role: true, locale: true, isActive: true, emailVerified: true } });
  // No recursive elevation or impersonating staff, even if the target was
  // promoted after this support session started.
  if (!target?.isActive || target.role === 'ADMIN' || target.role === 'SUPPORT' || isSupportOperator(target)) return caller;
  const targetGrant = await db.operatorSetting.findUnique({ where: { key: `access.${target.id}` } });
  const tg = targetGrant?.value as { expiresAt?: number; revoked?: boolean } | undefined;
  if (tg?.revoked !== true && typeof tg?.expiresAt === 'number' && tg.expiresAt > Date.now()) return caller;
  return { id: target.id, email: target.email, name: target.name, role: target.role, locale: target.locale, impersonator: { id: caller.id, email: caller.email, role: caller.role } };
}

/** Operator operations always use the real session actor, never the previewed user. */
export async function requireOperator(): Promise<Caller> {
  const caller = await getCaller({ realActor: true });
  if (!caller) throw domainErrors.unauthorized();
  if (!isSupportOperator(caller)) throw domainErrors.forbidden();
  return caller;
}

/** Требует аутентификации. Бросает `DomainError`, который маппится в 401. */
export async function requireCaller(): Promise<Caller> {
  const caller = await getCaller();
  if (!caller) throw domainErrors.unauthorized();
  return caller;
}

/** Требует роль не ниже указанной. */
export async function requireRole(minimum: UserRole): Promise<Caller> {
  const caller = await requireCaller();
  if (!hasAtLeastRole(caller.role, minimum)) throw domainErrors.forbidden();
  return caller;
}

export async function requireAdmin(): Promise<Caller> {
  const caller = await requireCaller();
  if (caller.role !== 'ADMIN') throw domainErrors.forbidden();
  return caller;
}

/** Требует конкретное право. Основной гвард для админки. */
export async function requireCapability(capability: Capability): Promise<Caller> {
  const caller = await requireCaller();
  const { hasCapability } = await import('./capabilities');
  if (!(await hasCapability(caller.role, capability, caller.email))) throw domainErrors.forbidden();
  return caller;
}

/**
 * Проверка владения сущностью — основной механизм для инструкторов и площадок.
 * Инструктор редактирует своё занятие не потому, что у него есть capability, а
 * потому, что занятие его. Администратор проходит проверку всегда.
 */
export async function assertOwnership(
  caller: Caller,
  ownerId: string | null | undefined,
): Promise<void> {
  if (caller.role === 'ADMIN') return;
  if (!ownerId || ownerId !== caller.id) throw domainErrors.forbidden();
}

/**
 * Инструктор, привязанный к текущему пользователю. Нужен там, где операция
 * относится к профилю инструктора, а не к аккаунту.
 */
export async function requireInstructorProfile(): Promise<{ caller: Caller; instructorId: string }> {
  const caller = await requireCaller();
  const profile = await db.instructorProfile.findUnique({
    where: { userId: caller.id },
    select: { id: true },
  });
  if (!profile) throw domainErrors.forbidden();
  return { caller, instructorId: profile.id };
}

/** Площадки, которыми пользователь управляет. Пустой список = нет доступа. */
export async function requireVenueMembership(venueId: string): Promise<Caller> {
  const caller = await requireCaller();
  if (caller.role === 'ADMIN') return caller;

  const membership = await db.venueMember.findUnique({
    where: { venueId_userId: { venueId, userId: caller.id } },
    select: { id: true },
  });
  if (!membership) throw domainErrors.forbidden();
  return caller;
}
