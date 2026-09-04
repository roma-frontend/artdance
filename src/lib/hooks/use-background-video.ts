/**
 * Воспроизведение фоновой петли ровно тогда, когда её видно.
 *
 * Декодирование видео — самая дорогая работа на странице, и по умолчанию браузер
 * продолжает её, пока элемент существует: пользователь читает отзывы в подвале, а
 * процессор всё ещё разбирает 25 кадров в секунду для первого экрана, который
 * ушёл далеко вверх. На ноутбуке это греющийся вентилятор и подтормаживания
 * прокрутки; на телефоне — ещё и батарея.
 *
 * Поэтому здесь три вещи, которых нет у обычного `<video autoplay>`:
 *
 * 1. **Пауза, когда петля вне области просмотра.** `IntersectionObserver`, а не
 *    обработчик прокрутки: браузер сам решает, когда считать пересечение.
 * 2. **Пауза, когда вкладка неактивна.** Браузеры throttle'ят таймеры, но
 *    декодирование muted-видео в фоне продолжают.
 * 3. **Старт не раньше, чем набралось данных.** `autoplay` начинает играть с
 *    первых же байтов и на медленном соединении даёт рывок на первых секундах —
 *    ровно там, где его видно лучше всего. Ждём `canplay`.
 *
 * Возвращает признак «петля сейчас активна». Он нужен шлейфу: его цикл рождает
 * копии кадра, и продолжать это для невидимого экрана бессмысленно.
 */

'use client';

import { useEffect, useState, type RefObject } from 'react';

interface BackgroundVideoOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Узел, по видимости которого принимается решение. */
  containerRef: RefObject<HTMLElement | null>;
  /** Петля вообще должна играть: `false` при экономии данных и просьбе убрать движение. */
  enabled: boolean;
}

export function useBackgroundVideo({
  videoRef,
  containerRef,
  enabled,
}: BackgroundVideoOptions): boolean {
  /** Виден ли контейнер. Начальное значение — «нет»: до замера ничего не играем. */
  const [inViewport, setInViewport] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInViewport(entry.isIntersecting);
      },
      /* Порога нет: важен сам факт пересечения, а не доля. */
      { threshold: 0 },
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, [containerRef, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const sync = () => setPageVisible(!document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [enabled]);

  const active = enabled && inViewport && pageVisible;

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
     * остаётся постер, а это полноценное состояние первого экрана.
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

  return active;
}
