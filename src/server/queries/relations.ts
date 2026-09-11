import 'server-only';

/**
 * СВЯЗИ С УЧЁТОМ КОРЗИНЫ — единственный способ читать вложенные записи.
 *
 * Расширение клиента (`src/lib/db.ts`) вырезает удалённое из любого чтения ВЕРХНЕГО
 * уровня, но до вложенных выборок расширения запросов Prisma не доходят. То есть
 * `venue.findMany({ select: { rooms: true } })` вернул бы залы, удалённые
 * поодиночке у живой площадки, и никакой фильтр верхнего уровня этого не поймает.
 *
 * Поэтому вложенная связь с мягко удаляемой моделью обязана нести `notTrashed`
 * явно — и здесь собраны те связи, которые повторяются. Инвариант проверяет
 * `relations.test.ts`: он падает на любой вложенной связи, открытой без фильтра.
 * Это дешевле, чем искать причину, почему на странице площадки виден удалённый зал.
 *
 * Обёртки-функции вместо литералов здесь НЕ используются: `where` из функции
 * приходит с расширенным типом, и Prisma теряет вывод типа результата — вместо
 * полей строки получается `any`. Литерал сохраняет вывод, а повторение слова
 * `notTrashed` в шести константах — ровно та цена, которую видно на ревью.
 */

import { notTrashed } from '@/domain/trash';

import { mediaSelect } from './media';

/**
 * Кадры записи. Один и тот же блок нужен занятию, инструктору, площадке,
 * товару, событию и отзыву — шесть копий одной выборки разъехались бы при первом
 * же изменении набора полей.
 */
export const mediaRelation = { where: notTrashed, select: mediaSelect } as const;

/**
 * Ближайшие проведения занятия.
 *
 * `take` разный (в карточке нужно одно, в списке — несколько), поэтому функция, а
 * не константа. Отменённое проведение исключено здесь, а не в четырёх вызовах:
 * «в карточке отменённое не показываем, а в списке показываем» — это не решение,
 * а расхождение.
 */
export function upcomingSessionsRelation(now: Date, take: number) {
  return {
    where: { ...notTrashed, startsAt: { gte: now }, isCancelled: false },
    orderBy: { startsAt: 'asc' },
    take,
    select: { startsAt: true, endsAt: true, capacity: true, bookedCount: true },
  } as const;
}

/** Залы площадки для карточки и страницы: только действующие. */
export const activeRoomsRelation = {
  where: { ...notTrashed, isActive: true },
  select: { areaSqm: true, capacity: true, pricePerHour: true, amenities: true },
} as const;

/** Только цены залов — для вычисления «от какой цены» без лишних полей. */
export const roomPricesRelation = {
  where: { ...notTrashed, isActive: true },
  select: { pricePerHour: true },
} as const;

/** Размеры товара, доступные к покупке. */
export const activeVariantsRelation = {
  where: { ...notTrashed, isActive: true },
  select: {
    sku: true,
    size: true,
    color: true,
    price: true,
    stock: true,
    reserved: true,
  },
} as const;

export { notTrashed };
