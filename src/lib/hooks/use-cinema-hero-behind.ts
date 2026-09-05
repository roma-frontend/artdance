/**
 * Лежит ли за шапкой кинематографичный первый экран.
 *
 * От этого зависит вся раскраска шапки: над тёмным кадром она прозрачная со
 * светлым текстом, над страницей — сплошная с тёмным.
 *
 * **Почему замер, а не порог прокрутки.** До 05.09.2026 здесь был порог из
 * прототипа: шапка становилась сплошной после 60 пикселей прокрутки. Это работало,
 * пока первый экран уезжал вверх сразу — 60 пикселей были моментом, когда кадр
 * уходил из-под шапки. Теперь первый экран приколот и занимает две высоты окна:
 * прежний порог красил шапку в цвет канвы, когда за ней ещё на два экрана вперёд
 * тёмный театр. Светлая полоса поверх тёмного кадра — не «состояние прокрутки», а
 * дефект, и увидеть его можно было только глазами.
 *
 * Поэтому вопрос задаётся прямо: достаёт ли обёртка первого экрана до нижней
 * кромки шапки. Ответ верен при любой высоте разгона, на любом экране и без
 * второго числа, которое нужно держать согласованным с первым.
 *
 * Реализовано через `useSyncExternalStore`: положение прокрутки — внешнее
 * состояние браузера, и `setState` в эффекте запрещён правилом линтера
 * (`react-hooks/set-state-in-effect`).
 *
 * Две детали, из-за которых это не однострочник:
 *
 * 1. Подписка отдаёт `onStoreChange` только при СМЕНЕ логического значения, а не
 *    на каждое событие прокрутки. Иначе React получал бы десятки уведомлений в
 *    секунду ради одного и того же `true`.
 * 2. Чтение геометрии отложено в `requestAnimationFrame`: обработчик прокрутки,
 *    читающий её синхронно, вызывает layout thrashing.
 *
 * Серверное значение — `enabled`: до гидратации страница считается непрокрученной,
 * то есть на странице с кинематографичным первым экраном шапка прозрачна. Это
 * совпадает с тем, что рисует сервер, поэтому предупреждения о несовпадении
 * разметки не возникает.
 */

'use client';

import { useCallback, useSyncExternalStore, type RefObject } from 'react';

import { HERO_STAGE_ATTRIBUTE } from '@/lib/hooks/use-hero-reveal';

export function useCinemaHeroBehind(
  headerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const measure = useCallback(() => {
    if (!enabled) return false;

    const stage = document.querySelector<HTMLElement>(`[${HERO_STAGE_ATTRIBUTE}]`);
    /* Кинематографичного экрана на странице нет — шапке нечего пропускать. */
    if (!stage) return false;

    /*
     * Высота берётся у самой шапки, а не из токена: токен задан в `rem`, и
     * пересчитывать его здесь значило бы завести второй источник одного размера.
     */
    const header = headerRef.current;
    const headerHeight = header ? header.getBoundingClientRect().height : 0;

    return stage.getBoundingClientRect().bottom > headerHeight;
  }, [enabled, headerRef]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let current = measure();
      let frame = 0;

      const read = () => {
        frame = 0;
        const next = measure();
        if (next === current) return;
        current = next;
        onStoreChange();
      };

      const schedule = () => {
        if (frame !== 0) return;
        frame = window.requestAnimationFrame(read);
      };

      window.addEventListener('scroll', schedule, { passive: true });
      /** Смена ориентации меняет высоту разгона, а с ней и момент перехода. */
      window.addEventListener('resize', schedule, { passive: true });

      return () => {
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        if (frame !== 0) window.cancelAnimationFrame(frame);
      };
    },
    [measure],
  );

  return useSyncExternalStore(subscribe, measure, () => enabled);
}
