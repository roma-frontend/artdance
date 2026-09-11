/**
 * АДРЕС СПИСКА АДМИНКИ — одно место, которое знает, как он собирается.
 *
 * Панель фильтров и пагинация ведут на ОДИН и тот же экран, и раньше каждая
 * строила его адрес сама. Разойтись им ничто не мешало: у фильтров есть `tab` и
 * `parent`, у пагинации — `page`, и потерянный при переходе фильтр выглядит как
 * «пагинация сбрасывает отбор» — жалоба, по которой не найти причину.
 *
 * Описание экрана, а не функция: панель фильтров — клиентский компонент, а
 * функцию из серверной страницы в него передать нельзя. Заказы, брони, выплаты,
 * модерация, люди, журнал и корзина не являются ресурсами реестра, но живут в тех
 * же таблицах с тем же поиском и той же пагинацией.
 */

import { routes, type AdminListParams, type AdminResource } from '@/config';

export type TableTarget =
  | { kind: 'resource'; resource: AdminResource }
  | { kind: 'orders' }
  | { kind: 'bookings' }
  | { kind: 'payouts' }
  | { kind: 'moderation' }
  | { kind: 'users' }
  | { kind: 'auditLog' }
  | { kind: 'trash' };

export function tableTargetHref(target: TableTarget, params: AdminListParams): string {
  switch (target.kind) {
    case 'resource':
      return routes.adminResource(target.resource, params);
    case 'orders':
      return routes.adminOrders(params);
    case 'bookings':
      return routes.adminBookings(params);
    case 'payouts':
      return routes.adminPayouts(params);
    case 'moderation':
      return routes.adminModeration(params);
    case 'users':
      return routes.adminUsers(params);
    case 'auditLog':
      return routes.adminAuditLog(params);
    case 'trash':
      return routes.adminTrash(params);
  }
}
