/**
 * Контент главной страницы.
 *
 * **Это единственный шов между «данными из фикстур» и «данными из базы».**
 * Сегодня функция собирает контент из демо-фикстур прототипа, потому что базы
 * ещё нет (задача 1.1 плана). Когда она появится, меняется реализация этой
 * функции — и ни одного компонента.
 *
 * Так сделано намеренно. Альтернатива — импортировать фикстуры прямо в секции —
 * привела бы к тому, что при подключении базы пришлось бы править десяток
 * компонентов, и каждый из них знал бы про имена файлов. Требование заказчика
 * «все фото и видео управляются из админки» означает, что медиа обязано быть
 * данными, а не литералом в разметке.
 *
 * Что здесь появится при переходе на базу (задача 2.1):
 *   • запрос к `MediaAsset` + `MediaAssetTranslation` вместо `demoMediaAlt`;
 *   • блоки главной из `ContentBlock` (`docs/07-feature-backlog.md`, A-17);
 *   • кеш и теги из `src/config/cache.ts` вокруг вызова;
 *   • показатели из аналитики вместо `demoHeroStats`.
 */

import 'server-only';

import { demoHeroStats, demoMediaAlt, demoStyleTiles } from '../../../prisma/fixtures/demo';
import type { HomeContent, LocalizedText, MediaRef, VideoRef } from '@/domain/content';

/**
 * Описание изображения на трёх языках. Отсутствие описания — не повод показать
 * пустой `alt`: это ошибка контента, и она должна быть заметна на разработке.
 */
function altFor(key: string): LocalizedText {
  const alt = demoMediaAlt[key];
  if (!alt) {
    throw new Error(
      `[content] Нет alt-текста для ассета «${key}». Добавьте его в prisma/fixtures/demo.ts ` +
        '(в production — MediaAsset.altText и переводы).',
    );
  }
  return alt;
}

function mediaRef(key: string, focalPoint?: string): MediaRef {
  return focalPoint ? { key, alt: altFor(key), focalPoint } : { key, alt: altFor(key) };
}

/**
 * Фоновая петля первого экрана.
 *
 * `null` до тех пор, пока исходник из макета (21,6 МБ) не закодирован по
 * `videoProcessing.heroLoop` и не загружен в бакет — задача 1.2b плана. Пока
 * источников нет, hero показывает постер, и это законное состояние, а не
 * заглушка: ровно так же экран выглядит при `prefers-reduced-motion` и при
 * включённой экономии данных.
 */
function heroVideo(): VideoRef | null {
  return null;
}

export function getHomeContent(): HomeContent {
  return {
    hero: {
      video: heroVideo(),
      image: mediaRef('hero-dancer'),
      stats: demoHeroStats,
    },
    styleTiles: demoStyleTiles.map((tile) => ({
      style: tile.style,
      image: mediaRef(tile.asset),
      classCount: tile.classCount,
    })),
    editorial: {
      image: mediaRef('editorial-rhythm'),
    },
  };
}
