/**
 * Правовые документы: состав, адреса и наличие текста на всех языках.
 *
 * Этот тест закрывает единственное приведение типа в `config/legal.ts`. Ключ
 * раздела собирается из шаблона (`legal.documents.<id>.sections.<section>`), и
 * компилятор проверить его не может. Здесь проверяется то же самое, но обходом
 * всех документов × разделов × трёх локалей: добавленный в конфигурацию раздел
 * без перевода валит CI, а не показывает посетителю пустой пункт оферты.
 *
 * Вторая проверка — совпадение слага с маршрутом. Слаг участвует в
 * `generateStaticParams`, а путь — в подвале и карте сайта; разойдясь, они дают
 * ссылку на 404 из подвала на каждой странице сайта.
 */

import { describe, expect, it } from 'vitest';

import {
  legalDocumentBySlug,
  legalDocumentIds,
  legalDocumentIntroKey,
  legalDocumentSlugs,
  legalDocumentTitleKey,
  legalDocuments,
  legalSectionBodyKey,
  legalSectionTitleKey,
} from './legal';
import en from '@/i18n/messages/en';
import hy from '@/i18n/messages/hy';
import ru from '@/i18n/messages/ru';

const catalogs = { en, ru, hy };

/** Значение по точечному пути. Возвращает `undefined`, если ключа нет. */
function lookup(messages: object, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      messages,
    );
}

describe('состав правовых документов', () => {
  it('перечислены все объявленные документы', () => {
    expect(legalDocuments.map((document) => document.id)).toEqual([...legalDocumentIds]);
  });

  it('путь документа заканчивается его слагом', () => {
    for (const document of legalDocuments) {
      expect(document.href, document.id).toBe(`/legal/${document.slug}`);
    }
  });

  it('слаги уникальны и совпадают со списком для статической сборки', () => {
    expect(new Set(legalDocumentSlugs).size).toBe(legalDocumentSlugs.length);
    expect(legalDocumentSlugs).toEqual(legalDocuments.map((document) => document.slug));
  });

  it('документ находится по слагу, неизвестный слаг — undefined', () => {
    expect(legalDocumentBySlug('terms')?.id).toBe('terms');
    expect(legalDocumentBySlug('nothing-like-this')).toBeUndefined();
  });

  it('у каждого документа есть разделы', () => {
    for (const document of legalDocuments) {
      expect(document.sections.length, document.id).toBeGreaterThan(0);
      expect(new Set(document.sections).size, document.id).toBe(document.sections.length);
    }
  });

  it('дата вступления в силу — разбираемая дата', () => {
    for (const document of legalDocuments) {
      expect(Number.isNaN(new Date(document.effectiveDate).getTime()), document.id).toBe(false);
    }
  });
});

describe('переводы правовых документов', () => {
  for (const [locale, messages] of Object.entries(catalogs)) {
    it(`«${locale}»: у каждого документа есть заголовок и вступление`, () => {
      for (const document of legalDocuments) {
        expect(typeof lookup(messages, legalDocumentTitleKey(document.id)), document.id).toBe(
          'string',
        );
        expect(typeof lookup(messages, legalDocumentIntroKey(document.id)), document.id).toBe(
          'string',
        );
      }
    });

    it(`«${locale}»: у каждого раздела есть заголовок и текст`, () => {
      for (const document of legalDocuments) {
        for (const section of document.sections) {
          const titleKey = legalSectionTitleKey(document.id, section);
          const bodyKey = legalSectionBodyKey(document.id, section);

          expect(typeof lookup(messages, titleKey), titleKey).toBe('string');
          expect(typeof lookup(messages, bodyKey), bodyKey).toBe('string');
        }
      }
    });

    it(`«${locale}»: в каталоге нет разделов, которых нет в конфигурации`, () => {
      /*
       * Обратная сторона той же ошибки: раздел удалён из документа, а перевод
       * остался. Он не показывается, живёт в файле годами и переводится вручную
       * при каждом обновлении текста.
       */
      for (const document of legalDocuments) {
        const translated = lookup(messages, `legal.documents.${document.id}.sections`);
        expect(Object.keys(translated as object).sort(), document.id).toEqual(
          [...document.sections].sort(),
        );
      }
    });
  }
});
