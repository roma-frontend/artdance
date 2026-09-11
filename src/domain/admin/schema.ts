/**
 * СХЕМЫ АДМИНСКИХ ФОРМ — из описания полей, а не руками для каждого раздела.
 *
 * Почему схема собирается из `AdminFieldSpec`, а не пишется отдельно. Ручная
 * схема рядом с описанием формы означает два источника правды об одном поле:
 * форма показывает «Цена, целые драмы», а схема разрешает 12.5; форма помечает
 * поле обязательным, а схема принимает пустую строку. Такое расхождение не видно
 * на ревью и обнаруживается записью мусора в БД.
 *
 * Здесь один разбор на весь проект: вид поля определяет и виджет, и правило
 * проверки. `money` — целое неотрицательное; `slug` — латиница с дефисами;
 * `time` — ЧЧ:ММ; `list` — строки без пустых; `select` — только объявленные
 * значения. Добавить вид поля можно только в двух местах сразу.
 *
 * Тексты ошибок — ключи `validation.*`, как во всех схемах проекта: одна схема
 * обслуживает три языка.
 *
 * Модуль в домене, а не рядом с действием: `'use server'`-файл не может
 * экспортировать константы, а схема нужна и серверу (проверка), и клиенту
 * (значения по умолчанию).
 */

import { z } from 'zod';

import { limits } from '@/config/business';
import type { AdminFieldSpec, AdminResourceSpec } from '@/config/admin';
import { defaultLocale, locales, type Locale } from '@/i18n/config';

/**
 * Значение поля админской формы. Только сериализуемое.
 *
 * Массив изменяемый, а не `readonly`: значение уходит в server action, где его
 * тип выводит Zod (`z.array(z.string())` → `string[]`), и `readonly` здесь дал бы
 * несовместимость на каждой отправке формы.
 */
export type AdminFieldValue = string | number | boolean | string[] | null;

export type AdminFormValues = Record<string, AdminFieldValue>;

/** Слаг: латиница, цифры, дефисы между сегментами. Часть публичного адреса. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Время суток в расписании площадки. Хранится строкой, а не датой. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Максимум пунктов в списочном поле: «чему научит», «требования». */
const MAX_LIST_ITEMS = 20;

/**
 * Локали переводов — все, кроме основной: основное значение живёт в самой
 * записи. Держать в `*Translation` копию основного языка значит получить два
 * места, где написано название, и вечный вопрос, какое из них правда.
 */
export const translationLocales: readonly Locale[] = locales.filter((locale) => locale !== defaultLocale);

/** Имя поля перевода в форме: `title__ru`. */
export function translationFieldName(field: string, locale: Locale): string {
  return `${field}__${locale}`;
}

/** Разбор имени поля перевода. `null`, если это обычное поле. */
export function parseTranslationField(name: string): { field: string; locale: Locale } | null {
  const separator = name.indexOf('__');
  if (separator === -1) return null;

  const field = name.slice(0, separator);
  const suffix = name.slice(separator + 2);
  const locale = locales.find((value) => value === suffix);

  return locale ? { field, locale } : null;
}

/* ─────────────────────────── Схема одного поля ─────────────────────────── */

function textSchema(max: number) {
  return z.string().trim().max(max, 'validation.maxLength');
}

function fieldSchema(field: AdminFieldSpec, required: boolean): z.ZodTypeAny {
  switch (field.kind) {
    case 'slug':
      return z
        .string()
        .trim()
        .toLowerCase()
        .max(120, 'validation.maxLength')
        .regex(SLUG_PATTERN, 'validation.required');

    case 'text':
      return required ? textSchema(limits.text.titleMax).min(1, 'validation.required') : textSchema(limits.text.titleMax);

    case 'email':
      return z.string().trim().toLowerCase().email('validation.email').max(254, 'validation.maxLength');

    case 'textarea':
      return required
        ? textSchema(limits.text.descriptionMax).min(1, 'validation.required')
        : textSchema(limits.text.descriptionMax);

    case 'list':
      return z
        .array(
          z
            .string()
            .trim()
            .min(1, 'validation.required')
            .max(limits.text.titleMax, 'validation.maxLength'),
        )
        .max(MAX_LIST_ITEMS, 'validation.tooManyFiles');

    case 'number':
      return z
        .number({ message: 'validation.required' })
        .int('validation.required')
        .min(field.min ?? 0, 'validation.min')
        .max(field.max ?? 1_000_000, 'validation.max');

    case 'decimal':
      /* Дробное значение допустимо: это координаты. Границы — из описания поля. */
      return z
        .number({ message: 'validation.required' })
        .min(field.min ?? -180, 'validation.min')
        .max(field.max ?? 180, 'validation.max');

    case 'money':
      /* Целые драмы. Дробное значение — не «округлим», а ошибка ввода. */
      return z
        .number({ message: 'validation.required' })
        .int('validation.required')
        .min(0, 'validation.min')
        .max(100_000_000, 'validation.max');

    case 'rate':
      return z.number({ message: 'validation.required' }).min(0, 'validation.min').max(1, 'validation.max');

    case 'switch':
      return z.boolean();

    case 'select':
      return z.string().trim().refine(
        (value) => (field.options ?? []).some((option) => option.value === value),
        'validation.required',
      );

    case 'multiselect':
      return required
        ? z
            .array(
              z
                .string()
                .trim()
                .refine(
                  (value) => (field.options ?? []).some((option) => option.value === value),
                  'validation.required',
                ),
            )
            .min(1, 'validation.required')
        : z.array(
            z
              .string()
              .trim()
              .refine(
                (value) => (field.options ?? []).some((option) => option.value === value),
                'validation.required',
              ),
          );

    case 'date':
    case 'datetime':
      /*
       * ISO-строка, а не `Date`: значение проходит через форму и сеть, и
       * промежуточных представлений быть не должно. В `Date` его превращает
       * реестр перед записью.
       */
      return z
        .string()
        .trim()
        .refine((value) => !Number.isNaN(Date.parse(value)), 'validation.invalidDate');

    case 'time':
      return z.string().trim().regex(TIME_PATTERN, 'validation.required');

    case 'relation':
      return required
        ? z.string().trim().min(1, 'validation.required').max(64, 'validation.maxLength')
        : z.string().trim().max(64, 'validation.maxLength');
  }
}

/**
 * Необязательное поле. Пустая строка приходит из любой формы (селект «не
 * выбрано», очищенный ввод) и означает «нет значения», а не строку нулевой
 * длины: иначе в БД появляются пустые слаги и пустые адреса.
 */
function optionalize(schema: z.ZodTypeAny): z.ZodTypeAny {
  return z.preprocess((value) => (value === '' || value === undefined ? null : value), schema.nullable());
}

/* ────────────────────────── Схема целого ресурса ────────────────────────── */

/**
 * Схема формы ресурса: основные поля плюс поля переводов для каждой
 * дополнительной локали. Переводы всегда необязательны — пустое поле означает
 * «показывать основной язык», а не «показывать пустоту».
 */
export function buildResourceSchema(spec: AdminResourceSpec): z.ZodType<AdminFormValues> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of spec.fields) {
    const required = field.required === true;
    shape[field.name] = required ? fieldSchema(field, true) : optionalize(fieldSchema(field, false));

    if (field.localized === true) {
      for (const locale of translationLocales) {
        shape[translationFieldName(field.name, locale)] = optionalize(fieldSchema(field, false));
      }
    }
  }

  /*
   * `strip`, а не `strict`: клиент может прислать поле, которого в описании нет
   * (устаревшая вкладка после деплоя). Отбросить лишнее безопаснее, чем ответить
   * ошибкой на форму, которую человек только что заполнил.
   */
  return z.object(shape) as unknown as z.ZodType<AdminFormValues>;
}

/** Значения по умолчанию для формы создания: пустая форма без `undefined`. */
export function emptyValues(spec: AdminResourceSpec): AdminFormValues {
  const values: AdminFormValues = {};

  for (const field of spec.fields) {
    values[field.name] = defaultValue(field);

    if (field.localized === true) {
      for (const locale of translationLocales) {
        values[translationFieldName(field.name, locale)] = '';
      }
    }
  }

  return values;
}

function defaultValue(field: AdminFieldSpec): AdminFieldValue {
  switch (field.kind) {
    case 'switch':
      /* Новая запись создаётся активной: иначе её забывают включить. */
      return field.name === 'isActive';
    case 'list':
    case 'multiselect':
      return [];
    case 'number':
    case 'decimal':
    case 'money':
    case 'rate':
      return null;
    default:
      return '';
  }
}
