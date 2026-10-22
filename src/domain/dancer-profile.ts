/**
 * АНКЕТА ТАНЦОРА — правила онбординга.
 *
 * Домен, а не компонент: ответы проверяются и на сервере, и клиент хочет
 * знать, что можно пропустить, до того как нажал «Далее». Одно место с
 * правилами — иначе тур начнёт требовать то, чего сервер не примет, или
 * наоборот.
 *
 * **Уровень обязателен, остальное — нет.** Человек, который пришёл «посмотреть»,
 * не обязан заполнять анкету, чтобы пользоваться каталогом: незаполненные
 * стили и цель не блокируют ни сохранение, ни выход из тура.
 *
 * **Длины ограничены тем же `limits.text`, что и остальные формы.** Без предела
 * клиент присылает в базу мегабайты, а инструктор читает стену текста.
 */

import { z } from 'zod';

import { limits } from '@/config/business';
import { danceStyles, dancerLevels, type DanceStyle, type DancerLevel } from './enums';

/*
 * `as const`-массивы readonly, а `z.enum` ждёт изменяемый кортеж. Приведение
 * единственное: типы на выходе остаются `DancerLevel` и `DanceStyle`, а не
 * `string` — иначе в базу ушёл бы любой текст, прошедший проверку на сервере.
 */
const LEVELS = dancerLevels as unknown as [DancerLevel, ...DancerLevel[]];
const STYLES = danceStyles as unknown as [DanceStyle, ...DanceStyle[]];

/**
 * Ответ на один шаг тура.
 *
 * Шаг сохраняется целиком, а не «что изменилось»: форма с несколькими полями
 * отправляется одним объектом, и разбор «какие поля пришли» в действии дал бы
 * второй источник правды о том, что за шаг означает.
 */
export const dancerProfileSchema = z.object({
  level: z.enum(LEVELS, { message: 'validation.required' }),
  styles: z.array(z.enum(STYLES)).max(danceStyles.length).default([]),
  goal: z.string().trim().max(limits.text.messageMax).nullish(),
  note: z.string().trim().max(limits.text.messageMax).nullish(),
});

export type DancerProfileInput = z.infer<typeof dancerProfileSchema>;

/** Шаг тура: уровень обязателен, остальное можно пропустить. */
export const dancerOnboardingSchema = dancerProfileSchema.extend({
  /** `true` — человек дошёл до конца тура и ответы зафиксированы. */
  completed: z.boolean().default(false),
});

export type DancerOnboardingInput = z.infer<typeof dancerOnboardingSchema>;

/**
 * Пустая строка и `null` — одно и то же «не ответил».
 *
 * Без этого в базе копились бы прочерки, а инструктор увидел бы «—» там, где
 * человек просто ничего не написал.
 */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
