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

import dynamic from 'next/dynamic';

import { Media } from '@/components/ui/media';
import { resolveMedia, type VideoRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';

export interface HeroVideoProps {
  video: VideoRef | null;
  /** Постер. Отдельным пропсом: показывается и без видео. */
  poster: Parameters<typeof resolveMedia>[0];
  locale: Locale;
}

/**
 * Видео-слой ленивый: фоновое видео не блокирует LCP и декодируется после idle.
 * Poстер — единственная работа на критическом пути.
 */
const HeroVideoLayer = dynamic(() => import('./hero-video-layer').then((m) => m.HeroVideoLayer), {
  ssr: false,
  loading: () => null,
});

export function HeroVideo({ video, poster, locale }: HeroVideoProps) {
  const posterProps = resolveMedia(poster, locale);

  return (
    <div data-hero-background="" className="absolute inset-0 z-0 overflow-hidden">
      <Media
        {...posterProps}
        preset="heroFullBleed"
        priority
        fill
        className="absolute inset-0 size-full"
        imageClassName="opacity-100 transition-opacity duration-slow"
      />
      {/* Видео грузится только после idle/интеракции — не конкурирует с LCP; постер остаётся под ним. */}
      <HeroVideoLayer video={video} />
    </div>
  );
}
