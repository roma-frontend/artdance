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
import { danceStyleSlug, danceStyles, relatedDanceStyles, skillLevels } from '@/domain/enums';
import {
  getStyleHub,
  getStyleHubSlugs,
  getStyleSummaries,
  searchCatalog,
} from './catalog';

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


/**
 * Хабы направлений.
 *
 * Проверяется то, из-за чего страница может врать или пропасть из индекса:
 * счётчик, не совпадающий с показанными карточками; цена «от», взятая не из
 * минимума; попадание в карту сайта направления, которое никто не ведёт. Ни одно
 * из этих расхождений не видно на экране — первые два выглядят как обычная
 * страница, третье оборачивается отказом посетителя, пришедшего из поиска.
 */
describe('getStyleHub', () => {
  it('неизвестный слаг — это 404, а не исключение', () => {
    expect(getStyleHub('tap-dance')).toBeNull();
    expect(getStyleHub('')).toBeNull();
  });

  it('понимает слаг направления', () => {
    const hub = getStyleHub('hip-hop');
    expect(hub?.style).toBe('HIP_HOP');
    expect(hub?.slug).toBe('hip-hop');
  });

  it('счётчик занятий совпадает с числом занятий этого направления в каталоге', () => {
    for (const style of danceStyles) {
      const hub = getStyleHub(danceStyleSlug(style))!;
      const expected = demoClasses.filter((item) => item.style === style).length;
      expect(hub.classCount, `«${style}»`).toBe(expected);
    }
  });

  it('«от» — минимальная цена занятия, а не цена первого в списке', () => {
    const hub = getStyleHub('hip-hop')!;
    const prices = demoClasses.filter((item) => item.style === 'HIP_HOP').map((item) => item.price);

    expect(prices.length).toBeGreaterThan(0);
    expect(hub.priceFrom).toBe(Math.min(...prices));
  });

  it('без занятий цены нет, и это `null`, а не ноль', () => {
    const hub = getStyleHub('flamenco')!;

    expect(hub.classes).toHaveLength(0);
    expect(hub.priceFrom).toBeNull();
  });

  it('уровни идут в порядке словаря, а не в порядке данных', () => {
    for (const style of danceStyles) {
      const hub = getStyleHub(danceStyleSlug(style))!;
      const expected = skillLevels.filter((level) => hub.levels.includes(level));
      expect(hub.levels, `«${style}»`).toEqual(expected);
    }
  });

  it('показывает не больше карточек, чем объявлено в лимитах', () => {
    for (const style of danceStyles) {
      const hub = getStyleHub(danceStyleSlug(style))!;

      expect(hub.classes.length).toBeLessThanOrEqual(limits.styleHub.classes);
      expect(hub.instructors.length).toBeLessThanOrEqual(limits.styleHub.instructors);
      expect(hub.venues.length).toBeLessThanOrEqual(limits.styleHub.venues);
    }
  });

  it('залы — только те, где по этому направлению есть занятия', () => {
    for (const style of danceStyles) {
      const hub = getStyleHub(danceStyleSlug(style))!;
      const teaching = new Set(
        demoClasses.filter((item) => item.style === style).map((item) => item.venueSlug),
      );

      for (const venue of hub.venues) {
        expect(teaching.has(venue.slug), `«${style}»: зал «${venue.slug}» не ведёт направление`).toBe(
          true,
        );
      }
    }
  });

  it('соседние направления приходят из домена и не включают само направление', () => {
    for (const style of danceStyles) {
      const hub = getStyleHub(danceStyleSlug(style))!;

      expect(hub.related.map((item) => item.style)).toEqual([...relatedDanceStyles(style)]);
      expect(hub.related.map((item) => item.slug)).not.toContain(hub.slug);
    }
  });

  it('кадра может не быть, и это `null`, а не путь к несуществующему файлу', () => {
    const withoutPhoto = getStyleHub('flamenco')!;
    const withPhoto = getStyleHub('salsa')!;

    expect(withoutPhoto.image).toBeNull();
    expect(withPhoto.image?.key.length).toBeGreaterThan(0);
  });
});

describe('getStyleSummaries', () => {
  it('перечисляет все направления в порядке словаря', () => {
    expect(getStyleSummaries().map((item) => item.style)).toEqual([...danceStyles]);
  });
});

describe('getStyleHubSlugs', () => {
  const supplied = getStyleHubSlugs();

  it('включает направление, у которого есть занятия', () => {
    expect(supplied).toContain('hip-hop');
  });

  it('включает направление, у которого есть преподаватель без занятий', () => {
    const hub = getStyleHub('bachata')!;

    expect(hub.classCount).toBe(0);
    expect(hub.instructorCount).toBeGreaterThan(0);
    expect(supplied).toContain('bachata');
  });

  it('не включает направление без занятий и преподавателей', () => {
    const hub = getStyleHub('flamenco')!;

    expect(hub.classCount).toBe(0);
    expect(hub.instructorCount).toBe(0);
    expect(supplied).not.toContain('flamenco');
  });

  it('состав выводится из данных, а не задан списком', () => {
    for (const style of danceStyles) {
      const slug = danceStyleSlug(style);
      const hub = getStyleHub(slug)!;
      const hasSupply = hub.classCount > 0 || hub.instructorCount > 0;

      expect(supplied.includes(slug), `«${style}»`).toBe(hasSupply);
    }
  });
});
