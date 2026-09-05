/**
 * Воспроизведение фоновой петли ровно тогда, когда её видно.
 *
 * Декодирование видео — самая дорогая работа на странице, и по умолчанию браузер
 * продолжает её, пока элемент существует: пользователь читает отзывы в подвале, а
 * процессор всё ещё разбирает 25 кадров в секунду для первого экрана, который
 * ушёл далеко вверх. На ноутбуке это греющийся вентилятор и подтормаживания
 * прокрутки; на телефоне — ещё и батарея.
 *
 * Поэтому здесь четыре вещи, которых нет у обычного `<video autoplay>`:
 *
 * 1. **Пауза, когда петля вне области просмотра.** `IntersectionObserver`, а не
 *    обработчик прокрутки: браузер сам решает, когда считать пересечение.
 * 2. **Пауза, когда вкладка неактивна.** Браузеры throttle'ят таймеры, но
 *    декодирование muted-видео в фоне продолжают.
 * 3. **Старт не раньше, чем набралось данных.** `autoplay` начинает играть с
 *    первых же байтов и на медленном соединении даёт рывок на первых секундах —
 *    ровно там, где его видно лучше всего. Ждём `canplay`.
 * 4. **Файл не скачивается, пока петля далеко.** Петля ниже первого экрана
 *    (заявление бренда) не должна тратить трафик при загрузке страницы: до неё
 *    могут не долистать. Признак `near` говорит, что пора выбирать источник, и
 *    срабатывает за `preloadAheadViewports` экранов до появления.
 *
 * Возвращает два признака, и разница между ними существенная:
 *   • `near` — пора ГОТОВИТЬ петлю (качать). Область просмотра, расширенная на
 *     запас упреждения;
 *   • `active` — пора ИГРАТЬ. Настоящая область просмотра, активная вкладка и
 *     выбранный источник.
 *
 * `active` нужен ещё и шлейфу первого экрана: его цикл рождает копии кадра, и
 * продолжать это для невидимого экрана бессмысленно.
 */

'use client';

import { useEffect, useState, type RefObject } from 'react';

interface BackgroundVideoOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Узел, по видимости которого принимается решение. */
  containerRef: RefObject<HTMLElement | null>;
  /** Петля вообще может играть: `false` при экономии данных и просьбе убрать движение. */
  enabled: boolean;
  /**
   * Источник выбран и подставлен в элемент. До этого играть нечему, но наблюдать
   * за секцией уже нужно — иначе выбор источника ждал бы воспроизведения, а
   * воспроизведение выбора источника.
   */
  ready?: boolean;
  /**
   * За сколько высот области просмотра до появления считать петлю «на подходе».
   * `0` — только когда секция действительно видна (первый экран).
   */
  preloadAheadViewports?: number;
}

export interface BackgroundVideoState {
  /** Пора качать: секция на подходе. */
  near: boolean;
  /** Пора играть: секция видна, вкладка активна, источник есть. */
  active: boolean;
}

export function useBackgroundVideo({
  videoRef,
  containerRef,
  enabled,
  ready = true,
  preloadAheadViewports = 0,
}: BackgroundVideoOptions): BackgroundVideoState {
  /** Виден ли контейнер. Начальное значение — «нет»: до замера ничего не играем. */
  const [inViewport, setInViewport] = useState(false);
  const [nearAhead, setNearAhead] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    /* Порога нет: важен сам факт пересечения, а не доля. */
    const viewport = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInViewport(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    viewport.observe(container);

    /*
     * Второй наблюдатель — с запасом упреждения. Отдельный, а не один с
     * `rootMargin`: расширенная рамка отвечает на вопрос «пора качать», и если
     * считать по ней же видимость, петля начинала бы играть за экран до того,
     * как её видно, — то есть ровно та работа, которую этот хук и убирает.
     *
     * При нулевом запасе его нет вовсе: рамки совпадают, и «на подходе»
     * означает «видно» (см. `near` ниже).
     */
    if (preloadAheadViewports <= 0) return () => viewport.disconnect();

    const ahead = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          /* Однократно: файл, начавший качаться, не нужно «отменять» при уходе. */
          if (entry.isIntersecting) setNearAhead(true);
        }
      },
      { threshold: 0, rootMargin: `${Math.round(preloadAheadViewports * 100)}% 0px` },
    );
    ahead.observe(container);

    return () => {
      viewport.disconnect();
      ahead.disconnect();
    };
  }, [containerRef, enabled, preloadAheadViewports]);

  useEffect(() => {
    if (!enabled) return;

    const sync = () => setPageVisible(!document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [enabled]);

  const active = enabled && ready && inViewport && pageVisible;

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    if (!active) {
      element.pause();
      return;
    }

    /*
     * `play()` возвращает промис и законно отклоняется — политика автозапуска,
     * смена источника, размонтирование. Отказ здесь не ошибка: на экране
     * остаётся постер, а это полноценное состояние секции.
     */
    const start = () => {
      void element.play().catch(() => {});
    };

    if (element.readyState >= element.HAVE_FUTURE_DATA) {
      start();
      return;
    }

    element.addEventListener('canplay', start, { once: true });
    return () => element.removeEventListener('canplay', start);
  }, [active, videoRef]);

  /**
   * «На подходе». При нулевом запасе упреждения совпадает с видимостью: у
   * первого экрана упреждать нечего, он виден при загрузке.
   */
  const near = enabled && (preloadAheadViewports > 0 ? nearAhead : inViewport);

  return { near, active };
}
