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
 * 3. **Петля не грузится до первого кадра разметки** — источник появляется только
 *    после гидратации, и до этого момента `<video>` не тянет ни байта.
 * 4. **Трейл копий ограничен** политикой и включается только на широких экранах.
 *
 * Плавность воспроизведения обеспечивают три решения, каждое против конкретной
 * причины рывков:
 *
 * • **Источник выбирается по способности устройства декодировать его аппаратно**
 *   (`pickDecodableSource`). Самый лёгкий файл — AV1, но аппаратный декодер AV1
 *   есть далеко не у всех, и на остальных машинах браузер декодирует его
 *   процессором. Экономия 500 KB не стоит дёргающегося фона.
 * • **Петля играет только пока её видно** (`useBackgroundVideo`): вне области
 *   просмотра и в неактивной вкладке декодирование останавливается.
 * • **Старт после `canplay`**, а не с первых байтов: иначе первые секунды —
 *   самые заметные — идут рывками на медленном соединении.
 *
 * Кнопки паузы здесь нет по решению заказчика. WCAG 2.2.2 требует управления
 * движением дольше пяти секунд, и роль этого управления здесь выполняет
 * системная настройка: при `prefers-reduced-motion` и при экономии данных петля
 * не запускается вовсе, а на экране остаётся постер. Это принятая практика для
 * декоративного фона, но не полная замена видимой кнопке — если аудит потребует
 * именно её, компонент к этому готов: возвращается один блок разметки.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { Media } from '@/components/ui/media';
import { HeroGhostTrail } from '@/components/home/hero-ghost-trail';
import { videoProcessing } from '@/config/media-processing';
import { hasPlayableVideo, resolveMedia, type VideoRef } from '@/domain/content';
import { useBackgroundVideo } from '@/lib/hooks/use-background-video';
import { usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';
import { pickDecodableSource } from '@/lib/media/video-source';
import type { Locale } from '@/i18n/config';

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
  const containerRef = useRef<HTMLDivElement>(null);
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

  /**
   * Выбранный источник. Пока он не определён, `<video>` без `src` и не грузит
   * ничего: решение принимается по ответу `mediaCapabilities`, а не по порядку
   * `<source>` в разметке.
   */
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!playable || !hasPlayableVideo(video)) return;

    let cancelled = false;
    void pickDecodableSource(video.sources).then((chosen) => {
      if (!cancelled && chosen) setSource(chosen.url);
    });

    return () => {
      cancelled = true;
    };
  }, [playable, video]);

  /** Играет только пока видно; возвращённый признак ведёт за собой шлейф. */
  const active = useBackgroundVideo({
    videoRef,
    containerRef,
    enabled: playable && source !== null,
  });

  const posterProps = resolveMedia(poster, locale);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 overflow-hidden"
      data-parallax="background"
    >
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
          </div>

          {/*
            Шлейф копий кадра. Отдельным компонентом: у него своя стоимость и свои
            условия включения — широкий экран, разрешённое движение и играющая
            петля.
          */}
          <HeroGhostTrail wrapRef={wrapRef} videoRef={videoRef} active={active} />
        </>
      )}
    </div>
  );
}

/** Уложилась ли петля в бюджет. Используется в отчётах и в админке. */
export function videoWithinBudget(video: VideoRef): boolean {
  return video.bytes <= videoProcessing.heroLoop.maxBytes;
}
