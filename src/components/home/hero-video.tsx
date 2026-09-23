/**
 * HeroVideo — кадр первого экрана: живая фоновая петля.
 *
 * Версия 21.09.2026: занавес, раскрываемый прокруткой, убран целиком (решение
 * заказчика по итогам показа — спортивный образ вместо классического; жалоба
 * «один скролл — и дожидайся конца видео» била в сам приём). Первый экран снова
 * обычный полноэкранный фон: петля играет сама, прокрутка свободна с первого
 * пикселя, полосы разгона и приколотого экрана больше нет.
 *
 * **Почему отматывание несовместимо со спортивным видео — не только с вкусом.**
 * Скраб показывает кадры по запросу `currentTime`; при плотных ключевых кадрах
 * (раз в 8 кадров) движение читается перелистыванием. Медленный классический
 * кадр это прощал, быстрый спортивный — нет. Живая петля играет тем потоком,
 * для которого декодер и построен, поэтому «видео, которое не видео» здесь
 * исчезло само, вместе со скрабом.
 *
 * **Почему компонент повторяет `EditorialVideo`, а не импортирует его.**
 * Различий два, и оба обязательны: у hero постер в `heroFullBleed`-пресете и
 * упреждающей загрузки нет — секция видна при открытии страницы, упреждать
 * нечего (`preloadAheadViewports: 0`). Всё остальное — постер под видео,
 * появление кадра по готовности, выбор источника по `mediaCapabilities` —
 * общее, и это следствие одной архитектуры фоновых петель, а не копия.
 *
 * Обратной петли больше нет: она обслуживала обратный проход раскрытия.
 * `videoLoopPolicy.heroReverse` удалён из политики вместе с приёмом.
 *
 * Постер — первый кадр петли; он же единственное содержимое экрана при
 * `prefers-reduced-motion`, экономии данных и медленном соединении. Кнопки
 * паузы нет: роль управления движением выполняет системная настройка — то же
 * решение, что и у editorial-секции.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { Media } from '@/components/ui/media';
import { hasPlayableVideo, resolveMedia, type VideoRef } from '@/domain/content';
import { useBackgroundVideo } from '@/lib/hooks/use-background-video';
import { usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';
import { pickDecodableSource } from '@/lib/media/video-source';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export interface HeroVideoProps {
  video: VideoRef | null;
  /** Постер. Отдельным пропсом: показывается и без видео. */
  poster: Parameters<typeof resolveMedia>[0];
  locale: Locale;
}

export function HeroVideo({ video, poster, locale }: HeroVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillImage = usePrefersStillImage();

  /**
   * До гидратации `stillImage` равен `true`, поэтому сервер и клиент отдают
   * одинаковую разметку с одним постером, а клип появляется после того, как стали
   * известны предпочтения.
   */
  const playable = hasPlayableVideo(video) && !stillImage;

  /** Выбранный источник. Пока он не определён, `<video>` без `src` и не грузит. */
  const [source, setSource] = useState<string | null>(null);

  const { near, active } = useBackgroundVideo({
    videoRef,
    containerRef,
    enabled: playable,
    ready: source !== null,
    /**
     * Ноль, а не `preloadAheadViewportFactor`: первый экран виден при открытии
     * страницы, и «грузить заранее» ему некуда — иначе рамка упреждения просто
     * совпала бы с рамкой видимости, а намерение осталось бы непрочитанным.
     */
    preloadAheadViewports: 0,
  });

  useEffect(() => {
    if (!near || !hasPlayableVideo(video)) return;

    let cancelled = false;
    void pickDecodableSource(video.sources, 'hero').then((chosen) => {
      if (!cancelled && chosen) setSource(chosen.url);
    });

    return () => {
      cancelled = true;
    };
  }, [near, video]);

  /**
   * Кадр показывается только когда петля действительно идёт.
   *
   * Именно `active`, а не «источник выбран»: пока браузер качает файл, видео —
   * пустой чёрный прямоугольник, и проявлять его поверх постера значило бы
   * гасить первый экран на время загрузки.
   */
  const playing = active && source !== null;

  const posterProps = resolveMedia(poster, locale);

  return (
    <div ref={containerRef} data-hero-background="" className="absolute inset-0 z-0 overflow-hidden">
      {/*
        Постер лежит под кадром и остаётся видимым, пока браузер не отдал кадр
        клипа. Это же изображение — единственное содержимое экрана при экономии
        данных и при просьбе убрать движение.
      */}
      <Media
        {...posterProps}
        preset="heroFullBleed"
        priority
        fill
        className="absolute inset-0 size-full"
      />

      {playable && hasPlayableVideo(video) && (
        <div
          data-slot="hero-video-wrap"
          className={cn(
            'hero-video-wrap absolute inset-0 transition-opacity duration-slow ease-brand',
            playing ? 'opacity-100' : 'opacity-0',
          )}
        >
          <video
            ref={videoRef}
            data-slot="hero-clip"
            className="hero-video-main absolute inset-0 size-full object-cover"
            /*
             * `autoPlay` нет намеренно: воспроизведением управляет
             * `useBackgroundVideo` — старт по `canplay`, пауза вне видимости и
             * в фоновой вкладке.
             */
            muted
            loop
            playsInline
            src={source ?? undefined}
            preload={source === null ? 'none' : 'auto'}
            /** Без описания и без управления фокусом: это фон, а не контент. */
            aria-hidden
            tabIndex={-1}
          />
        </div>
      )}
    </div>
  );
}
