/**
 * ОБРАЩЕНИЯ — темы контактной формы.
 *
 * Словарь лежит в домене, а не рядом с действием, по двум причинам.
 *
 * **Техническая.** Модуль с `'use server'` может экспортировать только
 * асинхронные функции: константа в нём — ошибка сборки. Значит список тем всё
 * равно живёт отдельно от действия, которое его проверяет.
 *
 * **Смысловая.** Тема обращения нужна трём сторонам: форме (список вариантов),
 * действию (валидация) и письму (тема). Один источник на всех — единственный
 * способ не получить в отчётах «press» из формы и «media» из письма.
 */

import type { MessageKey } from '@/i18n/types';

/**
 * Порядок значим: он определяет порядок в списке. Первая тема выбрана по
 * умолчанию — это самое частое обращение (вопрос по брони), а не «другое».
 */
export const contactTopics = ['booking', 'order', 'instructor', 'press', 'other'] as const;

export type ContactTopic = (typeof contactTopics)[number];

export function isContactTopic(value: string): value is ContactTopic {
  return (contactTopics as readonly string[]).includes(value);
}

/**
 * Ключ подписи темы.
 *
 * Тип — `MessageKey`: ключ собирается из шаблона, и без него опечатка или
 * переименование namespace `contact.form.topics.*` обнаружились бы только пустым
 * выпадающим списком в браузере.
 */
export function contactTopicLabelKey(topic: ContactTopic): MessageKey {
  return `contact.form.topics.${topic}`;
}
