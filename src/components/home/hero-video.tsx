/**
 * HeroVideo — фоновая петля первого экрана.
 *
 * Компонент существует, чтобы закрыть пять дефектов эталона (см.
 * `design/reference/README.md`), а не просто вставить `<video>`:
 *
 * 1. **Постер показывается всегда.** В макете `autoplay` без `poster` — первый
 *    кадр пустой прямоугольник, и это LCP-элемент главной.
 * 2. **Автозапуск подавляется по настройке пользователя** — `prefers-reduced-motion`,
 *    `prefers-reduced-data`, `Save-Data`, медленное соединение. Тогда остаётся
 *    постер, и это полноценное состояние экрана, а не деградация.
 * 3. **Кнопка паузы обязательна.** WCAG 2.2.2: автоматическое движение дольше
 *    пяти секунд должно управляться пользователем. В макете её нет.
 * 4. **Петля не грузится до первого кадра разметки** — `preload="none"`.
 * 5. **Трейл копий ограничен** и включается только на широких экранах: в макете
 *    он создаёт до шести дополнительных `<video>`, то есть до семи потоков 1080p.
 *
 * Пока петля не закодирована (`content.hero.video === null`), компонент
 * показывает только постер и не грузит ни байта видео. Это штатное состояние.
 */

'use client';

import { useRef, useState } from 'react';

import { Media } from '@/components/ui/media';
import { videoProcessing } from '@/config/media-processing';
import { motion } from '@/design/motion';
import { hasPlayableVideo, resolveMedia, type VideoRef } from '@/domain/content';
import { usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

/** MIME-типы источников. Порядок в разметке задаёт приоритет для браузера. */
const mimeByFormat = {
  av1: 'video/mp4; codecs=av01.0.05M.08',
  vp9: 'video/webm; codecs=vp9',
  h264: 'video/mp4; codecs=avc1.640028',
} as const;

export interface HeroVideoProps {
  video: VideoRef | null;
  /** Постер. Отдельным пропсом: показывается и без видео. */
  poster: Parameters<typeof resolveMedia>[0];
  locale: Locale;
  /** Подписи кнопки управления. Это интерфейс, поэтому приходят из i18n. */
  labels: { play: string; pause: string };
}

/**
 * Хочет ли пользователь видеть движение и тратить трафик — читается подпиской
 * на системные настройки (`usePrefersStillImage`). Проверка именно в браузере, а
 * не в CSS: автозапуск — поведение, и медиа-запрос его не отключит.
 */
export function HeroVideo({ video, poster, locale, labels }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillImage = usePrefersStillImage();
  const [paused, setPaused] = useState(false);

  /**
   * До гидратации `stillImage` равен `true`, поэтому сервер и клиент отдают
   * одинаковую разметку с одним постером, а видео появляется после того, как
   * стали известны предпочтения. Это же значение делает постер полноценным
   * состоянием экрана при экономии данных.
   */
  const playable = hasPlayableVideo(video) && !stillImage;

  function toggle(): void {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      void element.play();
      setPaused(false);
    } else {
      element.pause();
      setPaused(true);
    }
  }

  const posterProps = resolveMedia(poster, locale);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/*
        Постер лежит под видео и остаётся видимым, пока петля не начала играть.
        Это же изображение — единственное содержимое экрана при экономии данных.
      */}
      <Media
        {...posterProps}
        preset="heroFullBleed"
        priority
        fill
        className="absolute inset-0 size-full"
        imageClassName="opacity-75"
      />

      {playable && hasPlayableVideo(video) && (
        <>
          <video
            ref={videoRef}
            className={cn(
              'absolute inset-0 size-full object-cover opacity-75',
              'transition-opacity duration-slow ease-brand',
            )}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            /** Без описания и без управления фокусом: это фон, а не контент. */
            aria-hidden
            tabIndex={-1}
            /** Ширина с запасом — под горизонтальный сдвиг без белых краёв. */
            style={{ width: `${motion.heroGhostTrail.wrapWidthPercent}%` }}
          >
            {video.sources.map((source) => (
              <source key={source.format} src={source.url} type={mimeByFormat[source.format]} />
            ))}
          </video>

          {/*
            Кнопка управления. Единственный интерактивный элемент фона, поэтому
            вынесена из `aria-hidden`-области и имеет читаемую подпись.
          */}
          <button
            type="button"
            onClick={toggle}
            aria-pressed={paused}
            className={cn(
              'absolute right-4 bottom-4 z-10 grid size-11 place-items-center rounded-full',
              'border border-border-on-cinema bg-surface-overlay text-content-on-cinema',
              'transition-colors duration-fast ease-brand hover:bg-accent hover:text-content-on-accent',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
            )}
          >
            <span className="sr-only">{paused ? labels.play : labels.pause}</span>
            {/* Иконка декоративна: смысл несёт подпись выше. */}
            <span aria-hidden className="text-sm leading-none">
              {paused ? '▶' : '❚❚'}
            </span>
          </button>
        </>
      )}
    </div>
  );
}

/** Уложилась ли петля в бюджет. Используется в отчётах и в админке. */
export function videoWithinBudget(video: VideoRef): boolean {
  return video.bytes <= videoProcessing.heroLoop.maxBytes;
}
