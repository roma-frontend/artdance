/**
 * EditorialVideo — оживший кадр заявления бренда.
 *
 * В утверждённом прототипе на этом месте статичная фотография
 * (`.editorial-bg > img`). Заказчик прислал клип 04.09.2026 и попросил поставить
 * его сюда — отклонение от макета согласовано, см. `docs/00-decision-record.md`
 * §8. Всё остальное в секции остаётся как в макете: типографика, scrim,
 * параллакс, кнопка.
 *
 * Что здесь сделано и почему именно так.
 *
 * **Постер лежит под видео и никогда не убирается.** Он же — единственное
 * содержимое секции при `prefers-reduced-motion`, `Save-Data` и медленном
 * соединении. Это не деградация: тёмный кадр со сцены самодостаточен, и
 * заявление бренда читается без движения.
 *
 * **Петля не скачивается, пока секция далеко.** Она лежит ниже первого экрана, и
 * загружать её при открытии страницы значило бы платить за то, до чего могут не
 * долистать. Источник выбирается за `preloadAheadViewportFactor` экранов до
 * появления — этого хватает, чтобы набрать данные до `canplay`, и кадр оживает
 * ровно тогда, когда секция входит в вид.
 *
 * **Проявление длится `--duration-cinematic`.** Петля начинается тем же кадром,
 * что и постер (постер извлечён из неё), поэтому подмена не читается как смена
 * картинки — кадр просто оживает.
 *
 * Три слоя эффекта, все на CSS и без работы на каждый кадр:
 *   1. кадр приглушён и растворён к краям маской (`--mask-cinema-edges`), поэтому
 *      у него нет видимых кромок — он гаснет в фон секции, а не заканчивается
 *      прямоугольником;
 *   2. поверх — радиальный scrim макета (тёплая тень в бордо);
 *   3. и вуаль под текстом (`--scrim-editorial-copy`): у движущегося кадра
 *      яркость за заголовком меняется каждый кадр, и без неё ivory-текст терял
 *      контраст в момент, когда по сцене проходит контровой свет.
 *
 * Кнопки паузы нет по тому же решению заказчика, что и у первого экрана
 * (`hero-video.tsx`): роль управления движением выполняет системная настройка.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { Media } from '@/components/ui/media';
import { videoProcessing } from '@/config/media-processing';
import { hasPlayableVideo, resolveMedia, type MediaRef, type VideoRef } from '@/domain/content';
import { useBackgroundVideo } from '@/lib/hooks/use-background-video';
import { usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';
import { pickDecodableSource } from '@/lib/media/video-source';
import type { Locale } from '@/i18n/config';

export interface EditorialVideoProps {
  video: VideoRef | null;
  /** Постер. Отдельным пропсом: показывается и без видео. */
  poster: MediaRef;
  locale: Locale;
}

export function EditorialVideo({ video, poster, locale }: EditorialVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillImage = usePrefersStillImage();

  /**
   * До гидратации `stillImage` равен `true`, поэтому сервер и клиент отдают
   * одинаковую разметку с одним постером, а видео появляется после того, как
   * стали известны предпочтения.
   */
  const playable = hasPlayableVideo(video) && !stillImage;

  const [source, setSource] = useState<string | null>(null);

  const { near, active } = useBackgroundVideo({
    videoRef,
    containerRef,
    enabled: playable,
    ready: source !== null,
    preloadAheadViewports: videoProcessing.preloadAheadViewportFactor,
  });

  useEffect(() => {
    if (!near || !hasPlayableVideo(video)) return;

    let cancelled = false;
    void pickDecodableSource(video.sources, 'editorial').then((chosen) => {
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
   * гасить секцию на время загрузки.
   */
  const playing = active && source !== null;

  return (
    <div ref={containerRef} className="absolute inset-0" data-slot="editorial-backdrop">
      {/*
        Постер. Тот же класс, что был у секции в макете: приглушение, лёгкое
        размытие и медленное приближение (эффект Кена Бёрнса).
      */}
      <Media
        {...resolveMedia(poster, locale)}
        /* Фон, а не иллюстрация: описание не нужно, нужен только кадр. */
        alt=""
        preset="editorialFullBleed"
        fill
        className="editorial-backdrop absolute inset-0 size-full"
      />

      {playable && hasPlayableVideo(video) && (
        <video
          ref={videoRef}
          className="editorial-video"
          data-playing={playing ? '' : undefined}
          /* `autoPlay` нет намеренно: воспроизведением управляет хук. */
          muted
          loop
          playsInline
          src={source ?? undefined}
          preload={source === null ? 'none' : 'auto'}
          /** Без описания и без управления фокусом: это фон, а не контент. */
          aria-hidden
          tabIndex={-1}
        />
      )}
    </div>
  );
}
