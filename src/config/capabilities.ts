/**
 * CAPABILITIES — тонкие права поверх ролей.
 *
 * Роль отвечает на вопрос «кто это», capability — «что ему можно». Без второго
 * слоя любая новая обязанность требует новой роли, и через полгода в системе
 * восемь ролей с непонятной разницей.
 *
 * Три правила модели (перенято из `builder-studio` и `online-shop`):
 *
 * 1. **Отсутствие записи = разрешено.** Новая capability не ломает поведение
 *    существующих админов: она просто ещё никем не запрещена.
 * 2. **ADMIN никогда не ограничивается.** Иначе неверная запись в матрице
 *    способна запереть владельца платформы вне админки.
 * 3. **Временные гранты перекрывают запрет.** Выдать доступ на два часа, а не
 *    менять роль навсегда и забывать откатить — это то, что реально происходит
 *    в поддержке.
 *
 * Матрица (`AccessControl`) и гранты (`AccessGrant`) хранятся в БД: их правит
 * владелец через админку, а не разработчик деплоем.
 */

export const capabilities = [
  /* Каталог и контент */
  'catalog.view',
  'catalog.edit',
  'catalog.publish',
  'media.upload',
  'media.delete',

  /* Бронирования */
  'bookings.view',
  'bookings.edit',
  'bookings.cancel',
  'bookings.override',

  /* Заказы и склад */
  'orders.view',
  'orders.edit',
  'orders.fulfil',
  'inventory.adjust',

  /* Деньги */
  'payments.view',
  'payments.refund',
  'payouts.view',
  'payouts.release',
  'reports.revenue',

  /* Люди */
  'users.view',
  'users.edit',
  'users.roleChange',
  'users.impersonate',
  'instructors.verify',
  'venues.verify',

  /* Модерация */
  'reviews.moderate',
  'content.moderate',

  /* Промо */
  'promotions.view',
  'promotions.edit',
  'giftCards.issue',

  /* Система */
  'settings.edit',
  'audit.view',
  'action.bulk',
  'data.export',
] as const;

export type Capability = (typeof capabilities)[number];

const capabilitySet = new Set<string>(capabilities);

export function isCapability(value: string): value is Capability {
  return capabilitySet.has(value);
}

/**
 * Базовый набор для каждой роли — то, что доступно ДО применения матрицы
 * запретов из БД. Роли клиента/инструктора/владельца площадки не участвуют в
 * capability-модели админки: их права определяются владением сущностью
 * (см. `assertOwnership` в guards).
 */
export const defaultRoleCapabilities: Record<string, readonly Capability[]> = {
  ADMIN: capabilities,
  SUPPORT: [
    'catalog.view',
    'bookings.view',
    'bookings.edit',
    'bookings.cancel',
    'orders.view',
    'payments.view',
    'users.view',
    'reviews.moderate',
    'content.moderate',
    'audit.view',
  ],
  INSTRUCTOR: [],
  VENUE_OWNER: [],
  CUSTOMER: [],
};

/** Максимальный срок временного гранта. Дольше — это уже смена роли. */
export const grantLimits = {
  minMinutes: 5,
  maxMinutes: 1_440,
  defaultMinutes: 120,
} as const;

/**
 * Capability, которые нельзя выдать временным грантом. Доступ к деньгам и
 * ролям меняется только осознанным решением о роли.
 */
export const nonGrantableCapabilities: readonly Capability[] = [
  'users.roleChange',
  'users.impersonate',
  'payouts.release',
  'settings.edit',
];
