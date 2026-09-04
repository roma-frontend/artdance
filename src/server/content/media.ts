/**
 * Ссылки на медиа для контент-слоя.
 *
 * Один способ превратить «ключ файла» в `MediaRef` для всех страниц. Вынесено
 * из `home.ts`, когда появился второй экран, которому нужны те же миниатюры:
 * копия функции в каждом источнике контента означала бы два места, где alt-текст
 * может тихо исчезнуть.
 *
 * Сегодня описания берутся из демо-фикстур прототипа, в production это
 * `MediaAsset.altText` + `MediaAssetTranslation`. Меняется реализация здесь — и
 * ни одного компонента.
 */

import 'server-only';

import { demoMediaAlt } from '../../../prisma/fixtures/demo';
import type { LocalizedText, MediaRef } from '@/domain/content';

/**
 * Описание изображения на трёх языках. Отсутствие описания — не повод показать
 * пустой `alt`: это ошибка контента, и она должна быть заметна на разработке.
 */
export function altFor(key: string): LocalizedText {
  const alt = demoMediaAlt[key];
  if (!alt) {
    throw new Error(
      `[content] Нет alt-текста для ассета «${key}». Добавьте его в prisma/fixtures/demo.ts ` +
        '(в production — MediaAsset.altText и переводы).',
    );
  }
  return alt;
}

export function mediaRef(key: string, focalPoint?: string): MediaRef {
  return focalPoint ? { key, alt: altFor(key), focalPoint } : { key, alt: altFor(key) };
}
