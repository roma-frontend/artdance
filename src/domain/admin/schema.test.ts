/**
 * Схемы админских форм.
 *
 * Проверяется то, что защищает данные каталога от формы: целые драмы, корректный
 * слаг, обязательность, значения только из объявленного словаря и необязательность
 * переводов. Схема генерируется из описания полей, поэтому один тест покрывает все
 * четырнадцать разделов сразу — но проверять нужно именно поведение видов полей.
 */

import { describe, expect, it } from 'vitest';

import { adminResourceSpecs } from '@/config/admin';
import { defaultLocale, locales } from '@/i18n/config';
import {
  buildResourceSchema,
  emptyValues,
  parseTranslationField,
  translationFieldName,
  translationLocales,
} from './schema';

const classes = adminResourceSpecs.classes;
const schema = buildResourceSchema(classes);

/** Минимально корректное занятие. Остальные тесты меняют по одному полю. */
function validClass() {
  return {
    slug: 'latin-fusion',
    title: 'Латина-фьюжн',
    description: 'Занятие для тех, кто уже держит ритм.',
    learningPoints: ['Базовый шаг', 'Связки'],
    instructorId: 'ckinstructor',
    venueId: '',
    style: 'SALSA',
    level: 'INTERMEDIATE',
    durationMinutes: 60,
    price: 12_000,
    capacity: 14,
    isTrending: false,
    isActive: true,
    title__ru: '',
    title__en: '',
    description__ru: '',
    description__en: '',
    learningPoints__ru: [],
    learningPoints__en: [],
  };
}

describe('buildResourceSchema', () => {
  it('принимает корректную запись', () => {
    expect(schema.safeParse(validClass()).success).toBe(true);
  });

  it('требует обязательные текстовые поля непустыми', () => {
    const result = schema.safeParse({ ...validClass(), title: '   ' });
    expect(result.success).toBe(false);
  });

  it('отклоняет нецелую цену: драм не делится', () => {
    expect(schema.safeParse({ ...validClass(), price: 12_000.5 }).success).toBe(false);
  });

  it('отклоняет отрицательную цену', () => {
    expect(schema.safeParse({ ...validClass(), price: -1 }).success).toBe(false);
  });

  it('проверяет границы числового поля из описания', () => {
    /* durationMinutes: min 15, max 480 */
    expect(schema.safeParse({ ...validClass(), durationMinutes: 14 }).success).toBe(false);
    expect(schema.safeParse({ ...validClass(), durationMinutes: 481 }).success).toBe(false);
    expect(schema.safeParse({ ...validClass(), durationMinutes: 15 }).success).toBe(true);
  });

  it('отклоняет слаг с недопустимыми символами', () => {
    for (const slug of ['Latin Fusion', 'латина', 'latin_fusion', '-latin', 'latin--fusion']) {
      expect(schema.safeParse({ ...validClass(), slug }).success, slug).toBe(false);
    }
  });

  it('принимает слаг из латиницы, цифр и дефисов', () => {
    expect(schema.safeParse({ ...validClass(), slug: 'latin-fusion-2' }).success).toBe(true);
  });

  it('отклоняет значение select вне словаря', () => {
    expect(schema.safeParse({ ...validClass(), style: 'TWERK' }).success).toBe(false);
  });

  it('оставляет необязательную связь пустой строкой, превращая её в null', () => {
    const result = schema.safeParse(validClass());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.venueId).toBeNull();
  });

  it('не требует переводов: пустой перевод означает основной язык', () => {
    const result = schema.safeParse({ ...validClass(), title__ru: '', description__en: '' });
    expect(result.success).toBe(true);
  });

  it('проверяет перевод теми же правилами, что основное поле', () => {
    const tooLong = 'x'.repeat(500);
    expect(schema.safeParse({ ...validClass(), title__ru: tooLong }).success).toBe(false);
  });

  it('требует непустой обязательный множественный выбор', () => {
    const instructors = buildResourceSchema(adminResourceSpecs.instructors);

    const base = {
      userId: 'ckuser',
      slug: 'anna-mkrtchyan',
      headline: 'Сальса и бачата',
      bio: 'Двенадцать лет на сцене.',
      styles: [],
      specializations: [],
      yearsExperience: 12,
      hourlyRateFrom: 15_000,
      acceptsTravel: false,
      travelRadiusKm: null,
      languages: [],
      isVerified: false,
      moderation: 'APPROVED',
      published: true,
    };

    expect(instructors.safeParse(base).success).toBe(false);
    expect(instructors.safeParse({ ...base, styles: ['SALSA'] }).success).toBe(true);
  });

  it('проверяет формат времени у площадки', () => {
    const venues = buildResourceSchema(adminResourceSpecs.venues);

    const base = {
      slug: 'pulse-dance-studio',
      name: 'Pulse',
      description: 'Три зала в центре.',
      district: 'Kentron',
      city: 'Yerevan',
      addressLine: 'Абовяна 12',
      latitude: 40.18,
      longitude: 44.51,
      phone: '',
      amenities: [],
      openTime: '08:00',
      closeTime: '23:00',
      moderation: 'APPROVED',
      published: true,
    };

    expect(venues.safeParse(base).success).toBe(true);
    expect(venues.safeParse({ ...base, openTime: '8:00' }).success).toBe(false);
    expect(venues.safeParse({ ...base, openTime: '24:00' }).success).toBe(false);
    expect(venues.safeParse({ ...base, closeTime: 'вечер' }).success).toBe(false);
  });
});

describe('поля переводов', () => {
  it('не включают язык по умолчанию: он живёт в самой записи', () => {
    expect(translationLocales).not.toContain(defaultLocale);
    expect(translationLocales.length).toBe(locales.length - 1);
  });

  it('имя поля разбирается обратно', () => {
    for (const locale of translationLocales) {
      const name = translationFieldName('title', locale);
      expect(parseTranslationField(name)).toEqual({ field: 'title', locale });
    }
  });

  it('обычное поле не считается переводом', () => {
    expect(parseTranslationField('title')).toBeNull();
    expect(parseTranslationField('title__xx')).toBeNull();
  });
});

describe('emptyValues', () => {
  it('заполняет каждое поле описания и каждый перевод', () => {
    const values = emptyValues(classes);

    for (const field of classes.fields) {
      expect(values, field.name).toHaveProperty(field.name);

      if (field.localized === true) {
        for (const locale of translationLocales) {
          expect(values).toHaveProperty(translationFieldName(field.name, locale));
        }
      }
    }
  });

  it('создаёт запись активной: иначе её забывают включить', () => {
    expect(emptyValues(classes).isActive).toBe(true);
  });

  it('числовые поля пусты, а не нулевые: ноль — это цена, а не «не заполнено»', () => {
    expect(emptyValues(classes).price).toBeNull();
    expect(emptyValues(classes).capacity).toBeNull();
  });
});
