/**
 * Рекламные слоты (DS-08): места на сайте, где может стоять баннер рекламодателя.
 *
 * Слот — точка на странице, а не баннер. Администратор привязывает к слоту
 * существующий баннер (`AdSlot.bannerId`), а решение о показе принимает этот
 * модуль: слот выключен, баннер не привязан, баннер выключен или вне окна показа
 * — ничего не рисуется. Функция чистая, поэтому её проверяет тест без БД.
 */

import { bannerLive } from '@/domain/banner';

/**
 * Точки, которые допускает сайт. Ключ в БД — свободная строка, но страница читает
 * только перечисленные здесь. Сейчас подключена лишь `catalog-top`; остальные
 * зарезервированы под решение владельца о месте на экране.
 */
export const AD_SLOT_KEYS = ['hero', 'catalog-top', 'checkout-sidebar'] as const;

export type AdSlotKey = (typeof AD_SLOT_KEYS)[number];

/** Поля баннера, нужные для решения о показе. */
export interface SlotBannerState {
  isActive: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

/** Слот с привязанным баннером, как его отдаёт запрос к `AdSlot`. */
export interface AdSlotState<B extends SlotBannerState> {
  isActive: boolean;
  banner: B | null;
}

/**
 * Баннер для слота или `null`. Возвращается тот же объект, что передан:
 * вызывающий код сам решает, какие поля отдать в разметку.
 */
export function resolveAdSlotBanner<B extends SlotBannerState>(
  slot: AdSlotState<B> | null,
  now: Date,
): B | null {
  if (!slot?.isActive || !slot.banner) return null;
  return bannerLive(slot.banner, now) ? slot.banner : null;
}
