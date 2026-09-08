/**
 * Транслитерация — фича C-03, и её ценность целиком в конкретных парах слов.
 * Поэтому тест проверяет не «функция что-то возвращает», а именно то, из-за чего
 * она написана: три написания одного слова обязаны дать один ключ, а опечатка на
 * одну букву не должна обнулять выдачу.
 */

import { describe, expect, it } from 'vitest';

import {
  highlightMatches,
  keyIncludes,
  levenshteinWithin,
  normalizeQuery,
  searchKey,
  transliterate,
} from './normalize';

const tolerance = { minWordLength: 5, maxEdits: 1 };

describe('normalizeQuery', () => {
  it('сводит регистр, пунктуацию и пробелы', () => {
    expect(normalizeQuery('  Hip-Hop   ДЛЯ  начинающих! ')).toBe('hip hop для начинающих');
  });

  it('снимает диакритику, оставляя букву', () => {
    expect(normalizeQuery('Café Ódeon')).toBe('cafe odeon');
  });

  it('не склеивает слова, разделённые дефисом', () => {
    expect(normalizeQuery('hip-hop')).not.toBe('hiphop');
  });

  it('возвращает пустую строку, если букв и цифр не было', () => {
    expect(normalizeQuery('!!! ??? ')).toBe('');
  });
});

describe('transliterate', () => {
  it('переводит армянский в латиницу', () => {
    expect(transliterate('Բաչատա', 'lat')).toBe('bachata');
    expect(transliterate('Սալսա', 'lat')).toBe('salsa');
  });

  it('обрабатывает армянский диграф ու как одну букву', () => {
    /* Без приоритета длинного ключа получилось бы «ov» и ни одного совпадения. */
    expect(transliterate('ուրախ', 'lat')).toBe('urakh');
  });

  it('переводит кириллицу в латиницу', () => {
    expect(transliterate('бачата', 'lat')).toBe('bachata');
    expect(transliterate('Хачатрян', 'lat')).toBe('khachatryan');
  });

  it('переводит латиницу в кириллицу без разбора диграфов по буквам', () => {
    expect(transliterate('bachata', 'cyr')).toBe('бачата');
    expect(transliterate('shakira', 'cyr')).toBe('шакира');
  });

  it('переводит латиницу в армянский', () => {
    expect(transliterate('salsa', 'hy')).toBe('սալսա');
  });

  it('оставляет символы целевого алфавита на месте', () => {
    expect(transliterate('salsa вечер', 'lat')).toBe('salsa vecher');
  });
});

describe('searchKey', () => {
  it('даёт один ключ трём написаниям названия направления', () => {
    const key = searchKey('bachata');
    expect(searchKey('Բաչատա')).toBe(key);
    expect(searchKey('бачата')).toBe(key);
    expect(searchKey('BACHATA')).toBe(key);
  });

  it('сводит խ / х / kh к одной букве в фамилии', () => {
    const key = searchKey('Khachatryan');
    expect(searchKey('Хачатрян')).toBe(key);
    expect(searchKey('Խաչատրյան')).toBe(key);
  });

  it('сжимает сдвоенную букву: Anna, Աննա и Анна — одно имя', () => {
    const key = searchKey('Anna');
    expect(searchKey('Աննա')).toBe(key);
    expect(searchKey('Анна')).toBe(key);
  });

  it('сводит написания города к одному ключу', () => {
    const key = searchKey('Yerevan');
    expect(searchKey('Ереван')).toBe(key);
    expect(searchKey('Երևան')).toBe(key);
  });

  it('совпадает у имени инструктора из фикстур во всех трёх алфавитах', () => {
    const key = searchKey('Nare Grigoryan');
    expect(searchKey('Наре Григорян')).toBe(key);
    expect(searchKey('Նարե Գրիգորյան')).toBe(key);
  });

  it('пустая строка означает «сравнивать нечего»', () => {
    expect(searchKey('—  —')).toBe('');
  });
});

describe('levenshteinWithin', () => {
  it('одинаковые строки проходят при нулевом пороге', () => {
    expect(levenshteinWithin('salsa', 'salsa', 0)).toBe(true);
  });

  it('одна замена укладывается в порог 1', () => {
    expect(levenshteinWithin('bochata', 'bachata', 1)).toBe(true);
  });

  it('две правки не укладываются в порог 1', () => {
    expect(levenshteinWithin('bochate', 'bachata', 1)).toBe(false);
  });

  it('разница длин больше порога отсекается без счёта', () => {
    expect(levenshteinWithin('salsa', 'salsateca', 1)).toBe(false);
  });
});

describe('keyIncludes', () => {
  it('находит по части слова', () => {
    expect(keyIncludes(searchKey('Salsa Basics'), searchKey('сал'), tolerance)).toBe(true);
  });

  it('прощает опечатку в достаточно длинном слове', () => {
    expect(keyIncludes(searchKey('Bachata Sensual'), searchKey('бочата'), tolerance)).toBe(true);
  });

  it('не прощает опечатку в коротком слове', () => {
    /* Иначе «low» находит «new», и выдача перестаёт зависеть от запроса. */
    expect(keyIncludes(searchKey('new class'), searchKey('low'), tolerance)).toBe(false);
  });

  it('пустой запрос совпадает со всем: фильтр не задан', () => {
    expect(keyIncludes(searchKey('что угодно'), '', tolerance)).toBe(true);
  });

  it('не находит того, чего нет', () => {
    expect(keyIncludes(searchKey('Ballet Foundations'), searchKey('tango'), tolerance)).toBe(false);
  });
});

describe('highlightMatches', () => {
  it('подсвечивает найденное в исходном написании, а не в ключе', () => {
    expect(highlightMatches('Bachata Basics', 'бачата')).toEqual([
      { text: 'Bachata', match: true },
      { text: ' Basics', match: false },
    ]);
  });

  it('подсвечивает армянское написание по латинскому запросу', () => {
    expect(highlightMatches('Աննա Մկրտչյան', 'anna')).toEqual([
      { text: 'Աննա', match: true },
      { text: ' Մկրտչյան', match: false },
    ]);
  });

  it('подсвечивает середину строки', () => {
    expect(highlightMatches('Evening Salsa Class', 'salsa')).toEqual([
      { text: 'Evening ', match: false },
      { text: 'Salsa', match: true },
      { text: ' Class', match: false },
    ]);
  });

  it('без совпадения отдаёт текст одним отрезком', () => {
    expect(highlightMatches('Ballet Foundations', 'tango')).toEqual([
      { text: 'Ballet Foundations', match: false },
    ]);
  });

  it('не подсвечивает совпадение по опечатке', () => {
    /* Подчёркнутое «Bachata» в ответ на «бочата» читается как сбой отрисовки. */
    expect(highlightMatches('Bachata Basics', 'бочата')).toEqual([
      { text: 'Bachata Basics', match: false },
    ]);
  });

  it('никогда не теряет и не добавляет символы', () => {
    const samples = [
      ['Hip-Hop Foundations', 'hip'],
      ['Աննա Մկրտչյան', 'мкртчян'],
      ['Pulse Dance Studio, Kentron', 'kentron'],
      ['Салса-вечер в Ереване', 'ереван'],
      ['', 'salsa'],
    ] as const;

    for (const [text, query] of samples) {
      expect(highlightMatches(text, query).map((chunk) => chunk.text).join('')).toBe(text);
    }
  });
});
