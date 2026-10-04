/**
 * Лежит ли за шапкой кинематографичный первый экран.
 *
 * От этого зависит вся раскраска шапки: над тёмным кадром она прозрачная со
 * светлым текстом, над страницей — сплошная с тёмным.
 *
 * **Почему замер, а не порог прокрутки.** До 05.09.2026 здесь был порог из
 * прототипа: шапка становилась сплошной после 60 пикселей прокрутки. Это работало,
 * пока первый экран уезжал вверх сразу — 60 пикселей были моментом, когда кадр
 * уходил из-под шапки. Пока первый экран был приколотым занавесом (05.09–21.09),
 * порог красил шапку в цвет канвы, когда за ней ещё на два экрана вперёд тёмный
 * театр. Светлая полоса поверх тёмного кадра — не «состояние прокрутки», а
 * дефект, и увидеть его можно было только глазами.
 *
 * Поэтому вопрос задаётся прямо: достаёт ли первый экран до нижней кромки шапки.
 * Ответ верен при любой высоте первого экрана, на любом экране и без второго
 * числа, которое нужно держать согласованным с высотой секции. Замер пережил
 * удаление занавеса (21.09.2026): секция снова обычный поток, но вопрос «виден
 * ли ещё кадр за шапкой» решается той же геометрией.
 *
 * Реализовано через `useState` + `useLayoutEffect`/`useEffect`: положение
 * прокрутки — внешнее состояние браузера.
 *
 * Две детали, из-за которых это не однострочник:
 *
 * 1. Оповещаем только при СМЕНЕ логического значения, а не на каждое событие
 *    прокрутки. Иначе React получал бы десятки уведомлений в секунду ради
 *    одного и того же `true`.
 * 2. Чтение геометрии отложено в `requestAnimationFrame`: обработчик прокрутки,
 *    читающий её синхронно, вызывает layout thrashing.
 *
 * Серверное значение — `enabled`: до гидратации страница считается непрокрученной,
 * то есть на странице с кинематографичным первым экраном шапка прозрачна. Это
 * совпадает с тем, что рисует сервер, поэтому предупреждения о несовпадении
 * разметки не возникает. При клиентской навигации `enabled` меняется
 * (`/` → `/discover`), и состояние синхронно пересчитывается в
 * `useLayoutEffect`, чтобы не было кадра с неправильным `solid`.
 */

'use client';

import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/** Селектор первого экрана. Класс секции, а не ролей внутри неё. */
const HERO_SELECTOR = '.hero-viewport';

export function useCinemaHeroBehind(
  headerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [behind, setBehind] = useState(enabled);

  const measure = useCallback(() => {
    if (!enabled) return false;

    const hero = document.querySelector<HTMLElement>(HERO_SELECTOR);
    /* Кинематографичного экрана на странице нет — шапке нечего пропускать. */
    if (!hero) return false;

    /*
     * Высота берётся у самой шапки, а не из токена: токен задан в `rem`, и
     * пересчитывать его здесь значило бы завести второй источник одного размера.
     */
    const header = headerRef.current;
    const headerHeight = header ? header.getBoundingClientRect().height : 0;

    return hero.getBoundingClientRect().bottom > headerHeight;
  }, [enabled, headerRef]);

  // Пересчитываем синхронно при смене enabled/маршрута до отрисовки,
  // чтобы не было кадра с неправильным solid-состоянием после клиентской навигации.
  useLayoutEffect(() => {
    const next = measure();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронный ресет при смене маршрута, иначе шапка остаётся в stale-состоянии до скролла
    setBehind((previous) => (previous === next ? previous : next));
  }, [enabled, measure]);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс на страницах без hero, иначе solid остаётся прозрачным
      setBehind((previous) => (previous === false ? previous : false));
      return;
    }

    let frame = 0;

    const read = () => {
      frame = 0;
      const next = measure();
      setBehind((previous) => (previous === next ? previous : next));
    };

    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(read);
    };

    // Подстраховка: DOM hero появляется после навигации, измеряем на следующий кадр
    schedule();

    window.addEventListener('scroll', schedule, { passive: true });
    /** Смена ориентации меняет высоту секции, а с ней и момент перехода. */
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [enabled, measure]);

  return behind;
}
