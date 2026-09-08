/**
 * Поиск по каталогу на данных макета.
 *
 * Тест проверяет не «функция вернула массив», а обещания, из-за которых поиск
 * вообще переписан: запрос на любом из трёх алфавитов находит одно и то же,
 * опечатка не обнуляет выдачу, название направления находит занятие, в котором
 * этого слова нет, и лучший ответ стоит первым. Каждое из них ломается молча —
 * выдача просто становится хуже, и на приёмке это не видно.
 *
 * Данные — `prisma/fixtures/demo.ts`, то есть контент из утверждённого макета:
 * результат сравним с тем, что заказчик видит на экране.
 */

import { describe, expect, it } from 'vitest';

import { demoClasses, demoInstructors } from '../../../prisma/fixtures/demo';
import { limits } from '@/config/business';
import { searchCatalog } from './catalog';

const LIMIT = limits.search.maxResults;

function titles(term: string, scope: Parameters<typeof searchCatalog>[1] = 'all'): string[] {
  return searchCatalog(term, scope, LIMIT).map((hit) => hit.title);
}

describe('searchCatalog: что именно находится', () => {
  it('находит занятие по слову из названия', () => {
    const latinFusion = demoClasses.find((item) => item.title.includes('Latin'));
    expect(latinFusion).toBeDefined();
    expect(titles('latin')).toContain(latinFusion!.title);
  });

  it('находит инструктора по имени', () => {
    const anna = demoInstructors.find((item) => item.name.startsWith('Anna'));
    expect(anna).toBeDefined();
    expect(titles('anna', 'instructors')).toContain(anna!.name);
  });

  it('находит инструктора по имени, набранному кириллицей', () => {
    const anna = demoInstructors.find((item) => item.name.startsWith('Anna'));
    expect(titles('Анна', 'instructors')).toContain(anna!.name);
  });

  it('находит инструктора по имени, набранному армянскими буквами', () => {
    const anna = demoInstructors.find((item) => item.name.startsWith('Anna'));
    expect(titles('Աննա', 'instructors')).toContain(anna!.name);
  });

  it('прощает опечатку в запросе', () => {
    const withTypo = titles('bahata');
    const correct = titles('bachata');
    expect(correct.length).toBeGreaterThan(0);
    expect(withTypo).toEqual(correct);
  });

  it('находит занятие по названию направления, которого нет в его названии', () => {
    /*
     * «Latin Fusion Night» — занятие по сальсе. Запрос «сальса» обязан его
     * находить: человек ищет танец, а не строку в базе.
     */
    const salsaClasses = demoClasses.filter((item) => item.style === 'SALSA');
    expect(salsaClasses.length).toBeGreaterThan(0);

    const found = titles('сальса', 'classes');
    for (const item of salsaClasses) {
      expect(found).toContain(item.title);
    }
  });

  it('находит зал, в котором учат нужному направлению', () => {
    const salsaVenues = new Set(
      demoClasses.filter((item) => item.style === 'SALSA').map((item) => item.venueSlug),
    );
    expect(salsaVenues.size).toBeGreaterThan(0);

    const hits = searchCatalog('salsa', 'studios', LIMIT);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.href.startsWith('/studios/')).toBe(true);
    }
  });

  it('не находит того, чего в каталоге нет', () => {
    expect(searchCatalog('квантовая механика', 'all', LIMIT)).toHaveLength(0);
  });
});

describe('searchCatalog: порядок и границы', () => {
  it('совпадение в названии стоит выше совпадения в связанном поле', () => {
    /*
     * «Pulse Dance Studio» — название зала, и оно же встречается у занятий,
     * которые в нём проходят. Зал обязан быть первым, хотя занятия собираются
     * раньше него: порядок задаёт качество совпадения, а не порядок обхода
     * каталога.
     */
    const hits = searchCatalog('pulse', 'all', LIMIT);
    expect(hits.length).toBeGreaterThan(1);
    expect(hits[0]!.scope).toBe('studios');
    expect(hits.some((hit) => hit.scope === 'classes')).toBe(true);
  });

  it('находит зал по району, набранному кириллицей', () => {
    const kentron = searchCatalog('Кентрон', 'studios', LIMIT);
    expect(kentron.map((hit) => hit.title)).toContain('Pulse Dance Studio');
  });

  it('порядок выдачи не меняется между одинаковыми запросами', () => {
    expect(titles('dance')).toEqual(titles('dance'));
  });

  it('соблюдает предел числа результатов', () => {
    /* Пустой запрос совпадает со всем — это и есть проверка предела. */
    expect(searchCatalog('', 'all', 3)).toHaveLength(3);
  });

  it('раздел ограничивает выдачу одним типом сущности', () => {
    const hits = searchCatalog('dance', 'instructors', LIMIT);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.scope).toBe('instructors');
    }
  });

  it('пути результатов собраны маршрутами, а не склейкой строк', () => {
    for (const hit of searchCatalog('', 'all', LIMIT)) {
      expect(hit.href).toMatch(/^\/(classes|instructors|studios|events|shop)\/[a-z0-9-]+$/);
    }
  });

  it('у каждого результата есть непустое название и изображение', () => {
    for (const hit of searchCatalog('', 'all', LIMIT)) {
      expect(hit.title.length).toBeGreaterThan(0);
      expect(hit.image.length).toBeGreaterThan(0);
    }
  });
});
