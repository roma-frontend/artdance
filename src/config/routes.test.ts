/**
 * Маршруты: защита по сегментам и сериализация фильтров.
 *
 * Тест появился после дефекта, который убрал из продукта целый публичный
 * раздел: `protectedPathPrefixes` содержит `/studio` (кабинет владельца зала), а
 * проверка была написана как `startsWith`. `'/studios'.startsWith('/studio')`
 * возвращает `true`, поэтому публичный листинг залов отправлял гостя на страницу
 * входа. Ни типы, ни сборка, ни линтер такого не видят.
 */

import { describe, expect, it } from 'vitest';

import { isProtectedPath, listingRoute, listingSections, routes } from './routes';

describe('isProtectedPath', () => {
  it('защищает раздел и всё, что под ним', () => {
    expect(isProtectedPath('/account')).toBe(true);
    expect(isProtectedPath('/account/bookings')).toBe(true);
    expect(isProtectedPath('/studio')).toBe(true);
    expect(isProtectedPath('/studio/schedule')).toBe(true);
    expect(isProtectedPath('/admin/users')).toBe(true);
    expect(isProtectedPath('/checkout/contact')).toBe(true);
  });

  it('не трогает публичные разделы с похожим началом пути', () => {
    /* Ровно тот случай, из-за которого появился тест. */
    expect(isProtectedPath('/studios')).toBe(false);
    expect(isProtectedPath('/studios/pulse-dance-studio')).toBe(false);
    expect(isProtectedPath('/venues')).toBe(false);
    expect(isProtectedPath('/accounts')).toBe(false);
  });

  it('не защищает корень и публичный каталог', () => {
    expect(isProtectedPath('/')).toBe(false);
    expect(isProtectedPath('/classes')).toBe(false);
    expect(isProtectedPath('/instructors/anna-mkrtchyan')).toBe(false);
  });
});

describe('listingRoute', () => {
  it('покрывает все разделы каталога', () => {
    for (const section of listingSections) {
      expect(typeof listingRoute[section]).toBe('function');
    }
  });

  it('собирает адрес раздела без параметров без вопросительного знака', () => {
    expect(listingRoute.classes()).toBe(routes.classes());
    expect(listingRoute.classes()).not.toContain('?');
  });

  it('переносит фильтры в query и выбрасывает пустые значения', () => {
    const href = listingRoute.classes({ style: 'hip-hop', level: undefined, page: 2 });

    expect(href).toContain('style=hip-hop');
    expect(href).toContain('page=2');
    expect(href).not.toContain('level');
  });

  it('не путает разделы между собой', () => {
    expect(listingRoute.shop({ category: 'shoes' })).toContain('/shop');
    expect(listingRoute.studios({ district: 'Kentron' })).toContain('/studios');
  });
});
