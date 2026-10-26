/**
 * Заказ на пакет занятий: общая точка входа для веба (`purchaseClassPassAction`)
 * и мобильного приложения (`/api/class-passes/purchase`).
 *
 * Пакет выдаёт `settle` после подтверждения оплаты, поэтому здесь создаётся только
 * заказ. Тумблер `packages` проверяется до создания заказа: выключенный модуль не
 * должен оставить в базе даже черновик.
 */

import { classPasses, classPassById, priceGuidance } from '@/config/pricing';
import type { Locale } from '@/i18n/config';
import { translateForSnapshot } from '@/i18n/snapshot';
import { classPassOfferPrice } from '@/domain/class-pass';
import { domainErrors } from '@/domain/errors';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { createDirectOrder } from '@/server/orders/service';

export const classPassIds = classPasses.map((pass) => pass.id) as [string, ...string[]];

/** Цена пакета — из каталога, а не из запроса: клиент присылает только `passId`. */
function priceOf(passId: string): { lessons: number; price: number } {
  const offer = classPassById(passId);
  if (!offer) throw domainErrors.notFound();
  const perLesson = classPassOfferPrice(priceGuidance.groupClass.typical, offer.discountRate, offer.lessons);
  return {
    lessons: offer.lessons,
    price: perLesson * offer.lessons,
  };
}

export type ClassPassBuyer = { id: string; email: string; name: string; locale: Locale };

export async function createClassPassOrder(buyer: ClassPassBuyer, passId: string) {
  await assertEntitlementOrThrow('packages');

  const { lessons, price } = priceOf(passId);

  /*
   * Название в заказе — переведённое и с числом занятий: `titleSnapshot`
   * читают в счёте и письме, где нет ни каталога переводов, ни конфигурации.
   * `translateForSnapshot`, а не `getTranslations`: действие не должно
   * зависеть от контекста запроса, чтобы его можно было вызвать и из теста,
   * и из задачи по расписанию.
   */
  const title = translateForSnapshot(buyer.locale, 'pricing.classPasses.lessonsCount', { count: lessons });

  /*
   * Контакты для заказа берутся из аккаунта, а не из формы: пакет покупает
   * тот, кто вошёл, и лишний набор полей здесь означал бы, что сумму можно
   * оформить на чужой адрес.
   */
  return createDirectOrder({
    userId: buyer.id,
    contact: { email: buyer.email, phone: '', name: buyer.name || buyer.email },
    lines: [
      {
        type: 'CLASS_PASS',
        title,
        unitPrice: price,
        metadata: { passId, lessons },
      },
    ],
  });
}
