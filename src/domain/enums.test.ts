/**
 * Единственное допустимое дублирование в проекте — enum'ы Prisma и TypeScript.
 * Этот тест делает его безопасным: расхождение схемы и домена станет красным
 * тестом, а не рантайм-ошибкой на проде при записи в БД.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  bookingStatuses,
  danceStyleAboutKey,
  danceStyleFromSlug,
  danceStyleGearKey,
  danceStyleLabelKey,
  danceStyleLedeKey,
  danceStyleSlug,
  danceStyles,
  danceStylesMatchingTerm,
  eventTypes,
  hasAtLeastRole,
  moderationStatuses,
  orderStatuses,
  paymentMethods,
  paymentStatuses,
  payoutStatuses,
  relatedDanceStyles,
  skillLevels,
  userRoles,
  venueAmenities,
} from './enums';
import { lineItemTypes } from '@/config/pricing';
import en from '@/i18n/messages/en';
import hy from '@/i18n/messages/hy';
import ru from '@/i18n/messages/ru';

const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');

function prismaEnumValues(name: string): string[] {
  const match = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`, 'm').exec(schema);
  if (!match?.[1]) throw new Error(`enum ${name} не найден в schema.prisma`);
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));
}

const pairs: Array<[string, readonly string[]]> = [
  ['UserRole', userRoles],
  ['DanceStyle', danceStyles],
  ['SkillLevel', skillLevels],
  ['BookingStatus', bookingStatuses],
  ['PaymentStatus', paymentStatuses],
  ['PaymentMethod', paymentMethods],
  ['OrderStatus', orderStatuses],
  ['PayoutStatus', payoutStatuses],
  ['ModerationStatus', moderationStatuses],
  ['EventType', eventTypes],
  ['VenueAmenity', venueAmenities],
  ['LineItemType', lineItemTypes],
];

describe('соответствие enum-ов Prisma и домена', () => {
  for (const [prismaName, tsValues] of pairs) {
    it(`${prismaName} совпадает со списком в TypeScript`, () => {
      expect([...prismaEnumValues(prismaName)].sort()).toEqual([...tsValues].sort());
    });
  }
});

describe('слаги направлений', () => {
  it('обратимы: style → slug → style', () => {
    for (const style of danceStyles) {
      expect(danceStyleFromSlug(danceStyleSlug(style))).toBe(style);
    }
  });

  it('не содержат подчёркиваний в URL', () => {
    for (const style of danceStyles) {
      expect(danceStyleSlug(style)).not.toContain('_');
    }
  });

  it('возвращают undefined на неизвестном слаге', () => {
    expect(danceStyleFromSlug('breakdance-fusion')).toBeUndefined();
  });
});

/**
 * Словарь написаний направлений — единственное место, где название направления
 * задано дважды: в каталоге переводов (что видит человек) и здесь (по чему его
 * находят). Расхождение выглядит так: раздел на экране есть, а поиском по его же
 * названию не находится. Тест закрывает именно это.
 */
describe('поиск направления по названию', () => {
  const catalogs = { en, ru, hy };

  function labelOf(messages: object, key: string): string {
    const value = key
      .split('.')
      .reduce<unknown>((node, segment) => (node as Record<string, unknown>)[segment], messages);
    if (typeof value !== 'string') throw new Error(`Ключ ${key} не строка`);
    return value;
  }

  for (const [locale, messages] of Object.entries(catalogs)) {
    it(`подпись на «${locale}» находит своё направление`, () => {
      for (const style of danceStyles) {
        const label = labelOf(messages, danceStyleLabelKey(style));
        expect(danceStylesMatchingTerm(label), `${style} → «${label}»`).toContain(style);
      }
    });
  }

  it('находит направление по разговорному написанию', () => {
    expect(danceStylesMatchingTerm('брейк-данс')).toContain('BREAKING');
    expect(danceStylesMatchingTerm('контемп')).toContain('CONTEMPORARY');
    expect(danceStylesMatchingTerm('растяжка')).toContain('STRETCHING');
  });

  it('находит направление в составном запросе', () => {
    /* Живой запрос — фраза, а не термин из справочника. */
    expect(danceStylesMatchingTerm('hip hop для детей')).toEqual(
      expect.arrayContaining(['HIP_HOP', 'KIDS']),
    );
  });

  it('находит направление на любом из трёх алфавитов', () => {
    for (const term of ['bachata', 'бачата', 'Բաչատա']) {
      expect(danceStylesMatchingTerm(term), term).toContain('BACHATA');
    }
  });

  it('прощает опечатку', () => {
    expect(danceStylesMatchingTerm('бочата')).toContain('BACHATA');
  });

  it('ничего не находит по слову не из предметной области', () => {
    expect(danceStylesMatchingTerm('ипотека')).toHaveLength(0);
  });

  it('пустой запрос ничего не предлагает', () => {
    expect(danceStylesMatchingTerm('   ')).toHaveLength(0);
  });
});

/**
 * Соседние направления — единственный выход с хаба вниз по каталогу.
 *
 * Проверяется не «правильность» связей (её видно глазами), а свойства, поломка
 * которых проявляется на конкретной странице и только на ней: направление,
 * ссылающееся на себя, даёт на хабе плитку «Сальса» под заголовком «Рядом с
 * сальсой»; опечатка в значении — пустую подпись из отсутствующего ключа i18n; а
 * один сосед — полосу из одной карточки в трёхколоночной сетке.
 */
describe('соседние направления', () => {
  it('объявлены у всех направлений и ведут на существующие', () => {
    for (const style of danceStyles) {
      const related = relatedDanceStyles(style);
      for (const neighbour of related) {
        expect(danceStyles, `«${style}» ссылается на неизвестное «${neighbour}»`).toContain(
          neighbour,
        );
      }
    }
  });

  it('не ссылаются на себя', () => {
    for (const style of danceStyles) {
      expect(relatedDanceStyles(style), `«${style}» ссылается на себя`).not.toContain(style);
    }
  });

  it('дают минимум двух соседей: блок «похожие» из одной карточки выглядит поломкой', () => {
    for (const style of danceStyles) {
      expect(relatedDanceStyles(style).length, `у «${style}» мало соседей`).toBeGreaterThanOrEqual(
        2,
      );
    }
  });

  it('не повторяются внутри одного направления', () => {
    for (const style of danceStyles) {
      const related = relatedDanceStyles(style);
      expect(new Set(related).size, `у «${style}» есть повтор`).toBe(related.length);
    }
  });
});

/**
 * Редакционные тексты направления — то, из-за чего хаб является документом, а не
 * каталогом с подставленным названием. Ключ собирается из шаблона, поэтому
 * опечатка в нём не видна ни типам, ни линтеру: страница падает в рантайме на
 * `MISSING_MESSAGE`, причём только у того направления, где ключ потерян.
 */
describe('описания направлений', () => {
  const catalogs = { en, ru, hy };

  function messageAt(catalog: object, key: string): unknown {
    return key.split('.').reduce<unknown>((node, part) => {
      if (node === null || typeof node !== 'object') return undefined;
      return (node as Record<string, unknown>)[part];
    }, catalog);
  }

  for (const [locale, catalog] of Object.entries(catalogs)) {
    it(`${locale}: у каждого направления есть описание, абзац и список вещей`, () => {
      for (const style of danceStyles) {
        for (const key of [
          danceStyleLedeKey(style),
          danceStyleAboutKey(style),
          danceStyleGearKey(style),
        ]) {
          const value = messageAt(catalog, key);
          expect(typeof value, `${locale}: нет ключа ${key}`).toBe('string');
          expect((value as string).length, `${locale}: пустой ${key}`).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('иерархия ролей', () => {
  it('администратор проходит любую проверку', () => {
    for (const role of userRoles) {
      expect(hasAtLeastRole('ADMIN', role)).toBe(true);
    }
  });

  it('клиент не проходит проверку на инструктора', () => {
    expect(hasAtLeastRole('CUSTOMER', 'INSTRUCTOR')).toBe(false);
  });

  it('инструктор и владелец площадки равноправны по уровню', () => {
    expect(hasAtLeastRole('INSTRUCTOR', 'VENUE_OWNER')).toBe(true);
    expect(hasAtLeastRole('VENUE_OWNER', 'INSTRUCTOR')).toBe(true);
  });
});
