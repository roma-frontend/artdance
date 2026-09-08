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
import { CalendarDays, GraduationCap, Music4, ShoppingBag, User, Warehouse } from 'lucide-react';
import type { CSSProperties } from 'react';

import { blurDataUrl, imagePresets, type ImagePresetKey, type MediaFallbackKind } from '@/config/media';
import { seedMedia } from '@/design/seed-media';
import { cn } from '@/lib/utils';

/**
 * Иконка заглушки по роли.
 *
 * Карта полная и проверяется типом: новая роль в `mediaFallbackKinds` без иконки
 * не соберётся. Иконки, а не файлы, — см. комментарий у `mediaFallbackKinds`:
 * заглушка обязана переключать тему вместе со страницей и не может быть SVG,
 * проходящим через оптимизатор изображений.
 */
const fallbackIcons = {
  avatar: User,
  instructor: GraduationCap,
  studio: Warehouse,
  product: ShoppingBag,
  classCard: Music4,
  event: CalendarDays,
} satisfies Record<MediaFallbackKind, typeof User>;

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
  fallback?: MediaFallbackKind;
  /** Классы контейнера. Само изображение всегда `object-cover`. */
  className?: string;
  /** Классы изображения — для эффектов вроде `scale` на hover родителя. */
  imageClassName?: string;
  /** Заполнить родителя вместо собственного соотношения сторон. */
  fill?: boolean;
  /** Точка фокуса кадра, если центр обрезает главное. */
  objectPosition?: CSSProperties['objectPosition'];
  /**
   * Размеры и плейсхолдер из данных.
   *
   * Приходят из `MediaAsset` вместе со ссылкой. Приоритет у них выше манифеста
   * сид-ассетов: манифест знает только файлы, лежащие в репозитории, а
   * загруженное заказчиком изображение существует лишь в базе и в бакете.
   * Без этих полей у такого кадра не резервируется место в разметке.
   */
  width?: number;
  height?: number;
  blurDataUrl?: string;
}

interface ResolvedSource {
  url: string;
  width?: number;
  height?: number;
  blur: string;
}

/**
 * Разрешение источника.
 *
 * Порядок важен: размеры из данных сильнее манифеста. Манифест — про файлы
 * репозитория (баннеры разделов, зашитые в код), данные — про всё остальное.
 */
function resolve(
  src: string,
  fromData: { width?: number; height?: number; blurDataUrl?: string },
): ResolvedSource {
  if (fromData.width !== undefined && fromData.height !== undefined) {
    return {
      url: src,
      width: fromData.width,
      height: fromData.height,
      blur: fromData.blurDataUrl ?? blurDataUrl,
    };
  }

  const seed = seedMedia(src);
  if (seed) {
    return { url: seed.src, width: seed.width, height: seed.height, blur: seed.blurDataUrl };
  }
  return { url: src, blur: fromData.blurDataUrl ?? blurDataUrl };
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
  width,
  height,
  blurDataUrl: blurFromData,
}: MediaProps) {
  const spec = imagePresets[preset];

  /**
   * Фотографии нет — рисуем заглушку роли.
   *
   * Место занимается тем же соотношением сторон, что и у настоящего кадра: иначе
   * карточка без фото ниже остальных и сетка рвётся. Иконка декоративна
   * (`aria-hidden`), а описание, если оно есть, отдаётся через `role="img"` с
   * `aria-label` — иначе на месте фотографии для скринридера нет ничего.
   */
  if (!src || src.length === 0) {
    if (!fallback) return null;

    const Icon = fallbackIcons[fallback];

    return (
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-surface-sunken',
          className,
        )}
        style={fill ? undefined : { aspectRatio: spec.aspectRatio }}
        {...(alt.length > 0 ? { role: 'img', 'aria-label': alt } : {})}
      >
        <Icon
          /*
           * Размер от контейнера, а не фиксированный: одна и та же заглушка
           * стоит и в аватаре 44px, и в обложке карточки 400px. Ограничение
           * сверху нужно, чтобы на большой обложке иконка не превратилась в
           * рисунок — заглушка обязана читаться как «фото нет», а не как контент.
           */
          className="size-1/3 max-h-12 max-w-12 text-content-tertiary"
          aria-hidden="true"
        />
      </div>
    );
  }

  const resolved = resolve(src, { width, height, blurDataUrl: blurFromData });
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
