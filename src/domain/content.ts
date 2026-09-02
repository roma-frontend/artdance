/**
 * КОНТЕНТ — типы того, что редактирует заказчик, а не разработчик.
 *
 * Требование, определяющее эти типы: **все фото и видео управляются из
 * админки.** Отсюда два следствия, которые важно принять до вёрстки:
 *
 * 1. **Компонент не знает имён файлов.** `<Media src="hero-dancer">` в разметке
 *    означает, что замена фото на главной — это правка кода и деплой. Поэтому
 *    ссылка на медиа приходит пропсом, а имя файла живёт в данных.
 * 2. **Альтернативный текст — это контент, а не интерфейс.** Он описывает
 *    конкретное фото, меняется вместе с ним и потому не может лежать в каталоге
 *    переводов рядом с надписями кнопок. В схеме под это есть
 *    `MediaAsset.altText` и `MediaAssetTranslation`.
 *
 * Тексты интерфейса (заголовки, подписи, CTA) остаются в i18n: они относятся к
 * продукту, а не к загруженному файлу. Управление блоками главной из админки —
 * отдельная задача (`docs/07-feature-backlog.md`, A-17), и эти типы к ней готовы.
 */

import type { Locale } from '@/i18n/config';

/** Строка на всех языках. В БД — таблица переводов, здесь — готовый результат. */
export type LocalizedText = Record<Locale, string>;

/** Ссылка на изображение. Ровно то, что вернёт запрос к `MediaAsset`. */
export interface MediaRef {
  /**
   * Ключ файла: имя сид-ассета на этапе разработки, ключ объекта в бакете
   * в production. Компонент `Media` различает их сам.
   */
  key: string;
  /** Описание изображения на трёх языках. Пустая строка = декоративное. */
  alt: LocalizedText;
  /** Точка фокуса кадра, если центр обрезает главное (`'50% 25%'`). */
  focalPoint?: string;
}

export type VideoFormat = 'av1' | 'vp9' | 'h264';

/** Ссылка на видео. Источники перечислены в порядке предпочтения. */
export interface VideoRef {
  sources: ReadonlyArray<{ format: VideoFormat; url: string }>;
  /** Постер обязателен: без него первый кадр — пустой прямоугольник. */
  poster: MediaRef;
  durationSeconds: number;
  /** Вес самого лёгкого источника, байт — для отчётов и проверки бюджета. */
  bytes: number;
}

/** Готовые для `<Media>` пропсы. Локаль применяется один раз, в одном месте. */
export function resolveMedia(
  ref: MediaRef,
  locale: Locale,
): { src: string; alt: string; objectPosition?: string } {
  return {
    src: ref.key,
    alt: ref.alt[locale],
    ...(ref.focalPoint ? { objectPosition: ref.focalPoint } : {}),
  };
}

/** Есть ли у видео хоть один источник. Пока петля не закодирована — нет. */
export function hasPlayableVideo(video: VideoRef | null): video is VideoRef {
  return video !== null && video.sources.length > 0;
}

/* ───────────────────────────── Главная страница ───────────────────────────── */

export interface HomeHeroContent {
  /** Фоновое видео. `null` до кодирования петли — тогда показывается постер. */
  video: VideoRef | null;
  /** Постер и он же фоллбэк. Отдельно от видео: используется всегда. */
  image: MediaRef;
  /**
   * Показатели первого экрана. Значения придут из аналитики, но набор и порядок
   * — контент: заказчик решает, чем хвалиться.
   */
  stats: ReadonlyArray<{ id: string; value: number; suffix: string; decimals: number }>;
}

export interface HomeStyleTile {
  /** Значение `DanceStyle`. Название берётся из i18n по этому ключу. */
  style: string;
  image: MediaRef;
  classCount: number;
}

export interface HomeContent {
  hero: HomeHeroContent;
  styleTiles: readonly HomeStyleTile[];
  editorial: { image: MediaRef };
}
