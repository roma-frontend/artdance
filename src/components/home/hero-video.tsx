/**
 * HeroVideo — фоновая петля первого экрана.
 *
 * Компонент существует, чтобы закрыть дефекты эталона (см.
 * `design/reference/README.md`), а не просто вставить `<video>`:
 *
 * 1. **Постер показывается всегда.** В макете `autoplay` без `poster` — первый
 *    кадр пустой прямоугольник, и это LCP-элемент главной.
 * 2. **Автозапуск подавляется по настройке пользователя** — `prefers-reduced-motion`,
 *    `prefers-reduced-data`, `Save-Data`, медленное соединение. Тогда остаётся
 *    постер, и это полноценное состояние экрана, а не деградация.
 * 3. **Петля не грузится до первого кадра разметки** — `preload="none"`.
 * 4. **Трейл копий ограничен** политикой и включается только на широких экранах.
 *
 * Кнопки паузы здесь нет по решению заказчика. WCAG 2.2.2 требует управления
 * движением дольше пяти секунд, и роль этого управления здесь выполняет
 * системная настройка: при `prefers-reduced-motion` и при экономии данных петля
 * не запускается вовсе, а на экране остаётся постер. Это принятая практика для
 * декоративного фона, но не полная замена видимой кнопке — если аудит потребует
 * именно её, компонент к этому готов: возвращается один блок разметки.
 */

'use client';

import { useRef } from 'react';

import { Media } from '@/components/ui/media';
import { HeroGhostTrail } from '@/components/home/hero-ghost-trail';
import { videoProcessing } from '@/config/media-processing';
import { hasPlayableVideo, resolveMedia, type VideoRef } from '@/domain/content';
import { usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';
import type { Locale } from '@/i18n/config';

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
}

/**
 * Хочет ли пользователь видеть движение и тратить трафик — читается подпиской
 * на системные настройки (`usePrefersStillImage`). Проверка именно в браузере, а
 * не в CSS: автозапуск — поведение, и медиа-запрос его не отключит.
 */
export function HeroVideo({ video, poster, locale }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  /** Обёртку сдвигает цикл шлейфа — поэтому ссылка живёт здесь, а не внутри него. */
  const wrapRef = useRef<HTMLDivElement>(null);
  const stillImage = usePrefersStillImage();

  /**
   * До гидратации `stillImage` равен `true`, поэтому сервер и клиент отдают
   * одинаковую разметку с одним постером, а видео появляется после того, как
   * стали известны предпочтения. Это же значение делает постер полноценным
   * состоянием экрана при экономии данных.
   */
  const playable = hasPlayableVideo(video) && !stillImage;

  const posterProps = resolveMedia(poster, locale);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" data-parallax="background">
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
          {/*
            Обёртка шире контейнера: сдвигается именно она, а не видео. Так
            устроено в макете, и это единственная геометрия, при которой правый
            край кадра не обнажается во время сдвига.
          */}
          <div ref={wrapRef} className="hero-video-wrap">
            <video
              ref={videoRef}
              className="transition-opacity duration-slow ease-brand"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              /** Без описания и без управления фокусом: это фон, а не контент. */
              aria-hidden
              tabIndex={-1}
            >
              {video.sources.map((source) => (
                <source key={source.format} src={source.url} type={mimeByFormat[source.format]} />
              ))}
            </video>
          </div>

          {/*
            Шлейф копий кадра. Отдельным компонентом: у него своя стоимость и свои
            условия включения — широкий экран и разрешённое движение.
          */}
          <HeroGhostTrail wrapRef={wrapRef} videoRef={videoRef} video={video} />
        </>
      )}
    </div>
  );
}

/** Уложилась ли петля в бюджет. Используется в отчётах и в админке. */
export function videoWithinBudget(video: VideoRef): boolean {
  return video.bytes <= videoProcessing.heroLoop.maxBytes;
}
