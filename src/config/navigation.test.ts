/**
 * Инварианты карты навигации.
 *
 * Проверяются не «правильные» ссылки — их правильность видна глазами, — а те
 * свойства, поломку которых заметит только пользователь: пропавший раздел,
 * разъехавшийся док, ссылка в выключенный модуль.
 */

import { describe, expect, it } from 'vitest';

import { features } from './features';
import {
  footerNavGroups,
  headerIconItems,
  mobileDockItems,
  mobileDockSlots,
  mobileMenuItems,
  primaryNavItems,
  type NavItem,
} from './navigation';

describe('нижний док', () => {
  /*
   * Пять колонок: четыре вкладки и центральная кнопка между ними. Если вкладка
   * исчезнет, остальные разъедутся и кнопка перестанет быть центральной —
   * поэтому в доке разрешены только разделы без флага поставки.
   */
  it('содержит ровно четыре вкладки при любых флагах', () => {
    expect(mobileDockItems).toHaveLength(mobileDockSlots.length);
  });

  it('ни один раздел дока не зависит от флага поставки', () => {
    for (const item of mobileDockItems) {
      expect(item.feature, `«${item.id}» в доке зависит от флага`).toBeUndefined();
    }
  });

  it('слоты уникальны и объявлены', () => {
    const slots = mobileDockItems.map((item) => item.slot);
    expect(new Set(slots).size).toBe(slots.length);
    for (const slot of slots) expect(mobileDockSlots).toContain(slot);
  });

  it('у каждой вкладки есть иконка: подпись в доке не читается сама по себе', () => {
    for (const item of mobileDockItems) expect(item.icon).toBeTruthy();
  });
});

describe('сетка разделов в шторке', () => {
  it('не повторяет то, что уже видно в доке', () => {
    const dockIds = new Set(mobileDockItems.map((item) => item.id));
    for (const item of mobileMenuItems) {
      expect(dockIds.has(item.id), `«${item.id}» дублирует вкладку дока`).toBe(false);
    }
  });

  /*
   * Главное свойство мобильной навигации: с телефона достижимо всё, что
   * достижимо с широкого экрана. Раздел, выпавший из обоих списков, для
   * половины пользователей просто не существует.
   */
  it('вместе с доком покрывает все разделы шапки', () => {
    const reachable = new Set([
      ...mobileDockItems.map((item) => item.id),
      ...mobileMenuItems.map((item) => item.id),
    ]);

    for (const item of [...primaryNavItems, ...headerIconItems]) {
      expect(reachable.has(item.id), `«${item.id}» недостижим с телефона`).toBe(true);
    }
  });
});

describe('выключенные модули', () => {
  const allItems = (): NavItem[] => [
    ...primaryNavItems,
    ...headerIconItems,
    ...mobileDockItems,
    ...mobileMenuItems,
    ...footerNavGroups.flatMap((group) => group.items),
  ];

  it('навигация не ведёт в раздел выключенного модуля', () => {
    for (const item of allItems()) {
      if (item.feature === undefined) continue;
      expect(features[item.feature], `«${item.id}» показан при выключенном модуле`).toBe(true);
    }
  });

  it('пустых колонок в подвале нет', () => {
    for (const group of footerNavGroups) expect(group.items.length).toBeGreaterThan(0);
  });
});
