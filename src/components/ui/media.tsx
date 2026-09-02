/**
 * Media — единственный компонент, которому разрешён `next/image`.
 *
 * Почему обёртка, а не прямое использование:
 *
 * 1. **`sizes` обязан совпадать с сеткой.** Если карточка занимает 25% ширины на
 *    десктопе, а `sizes` не указан, браузер скачает изображение под всю ширину
 *    экрана. Это самая частая причина проваленного LCP, и её невозможно поймать
 *    ревью — только замером. Здесь `sizes` приходит из preset, описанного
 *    рядом с сеткой (`src/config/media.ts`).
 * 2. **`priority` должен быть ровно один на экран.** Два «приоритетных»
 *    изображения конкурируют, и оба грузятся медленнее одного.
 * 3. **Размеры известны заранее.** Для сид-ассетов они берутся из
 *    сгенерированного манифеста, поэтому браузер резервирует место и вёрстка не
 *    прыгает (CLS).
 * 4. **Отсутствие фото не должно ломать сетку.** Фоллбэк выбирается по роли, а
 *    не «серым квадратом» по месту.
 *
 * Компонент серверный намеренно. Клиентский вариант потребовал бы состояния для
 * `onError`, а вместе с ним в браузер уехал бы весь манифест сид-ассетов с
 * base64-плейсхолдерами — около 12 KB на страницу ради демо-контента. Реальный
 * случай «фото нет» — это пустое значение в базе, и он обрабатывается здесь, до
 * рендера. Битую ссылку при существующем файле показывает сам браузер.
 *
 * Правило закреплено линтером: `next/image` вне этого файла — ошибка сборки.
 */

import NextImage from 'next/image';
import type { CSSProperties } from 'react';

import { blurDataUrl, imagePresets, mediaFallbacks, type ImagePresetKey } from '@/config/media';
import { seedMedia } from '@/design/seed-media';
import { cn } from '@/lib/utils';

type FallbackKind = keyof typeof mediaFallbacks;

export interface MediaProps {
  /**
   * Источник. Три варианта:
   *  • семантическое имя сид-ассета (`'hero-dancer'`) — размеры и blur берутся
   *    из сгенерированного манифеста;
   *  • путь в `public` (`'/media/og/default.jpg'`);
   *  • абсолютный URL из бакета.
   *
   * Пустая строка, `null` или `undefined` означают «фото нет» → фоллбэк.
   */
  src: string | null | undefined;
  /**
   * Текстовая альтернатива. Обязательна и не имеет значения по умолчанию:
   * `alt=""` допустим только для декоративного изображения и указывается явно.
   */
  alt: string;
  /** Роль изображения: определяет `sizes`, `quality`, соотношение сторон. */
  preset: ImagePresetKey;
  /**
   * Переопределяет `priority` из preset. Используется, когда одно и то же
   * изображение на одном экране — LCP, а на другом — нет.
   */
  priority?: boolean;
  /** Фоллбэк по роли, если фото нет. Без него пустой `src` вернёт `null`. */
  fallback?: FallbackKind;
  /** Классы контейнера. Само изображение всегда `object-cover`. */
  className?: string;
  /** Классы изображения — для эффектов вроде `scale` на hover родителя. */
  imageClassName?: string;
  /** Заполнить родителя вместо собственного соотношения сторон. */
  fill?: boolean;
  /** Точка фокуса кадра, если центр обрезает главное. */
  objectPosition?: CSSProperties['objectPosition'];
}

interface ResolvedSource {
  url: string;
  width?: number;
  height?: number;
  blur: string;
}

/** Разрешение источника: сид-ассет → путь, размеры и собственный плейсхолдер. */
function resolve(src: string): ResolvedSource {
  const seed = seedMedia(src);
  if (seed) {
    return { url: seed.src, width: seed.width, height: seed.height, blur: seed.blurDataUrl };
  }
  return { url: src, blur: blurDataUrl };
}

export function Media({
  src,
  alt,
  preset,
  priority,
  fallback,
  className,
  imageClassName,
  fill = false,
  objectPosition,
}: MediaProps) {
  const effectiveSrc = src && src.length > 0 ? src : fallback ? mediaFallbacks[fallback] : null;

  /** Нет ни фото, ни фоллбэка — не рисуем пустой блок и не ломаем сетку. */
  if (!effectiveSrc) return null;

  const spec = imagePresets[preset];
  const resolved = resolve(effectiveSrc);
  const isPriority = priority ?? spec.priority;

  /**
   * `fill` нужен, когда размер задаёт контейнер (hero, обложка). В остальных
   * случаях передаём реальные размеры: место резервируется без дополнительного CSS.
   */
  const useFill = fill || resolved.width === undefined || resolved.height === undefined;

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={useFill ? undefined : { aspectRatio: spec.aspectRatio }}
    >
      <NextImage
        src={resolved.url}
        alt={alt}
        sizes={spec.sizes}
        quality={spec.quality}
        priority={isPriority}
        /** Ленивая загрузка для всего, что не LCP — иначе приоритет теряет смысл. */
        loading={isPriority ? 'eager' : 'lazy'}
        placeholder="blur"
        blurDataURL={resolved.blur}
        className={cn('size-full object-cover', imageClassName)}
        style={objectPosition ? { objectPosition } : undefined}
        {...(useFill
          ? { fill: true }
          : { width: resolved.width as number, height: resolved.height as number })}
      />
    </div>
  );
}
