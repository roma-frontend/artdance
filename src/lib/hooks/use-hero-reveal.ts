/**
 * Раскрытие первого экрана: геометрия полосы разгона, её прогресс и жест.
 *
 * Первый экран приколот к верху окна (`position: sticky`), а его обёртка выше окна
 * на `heroParallax.revealRunwayViewports`. Разница между высотой обёртки и высотой
 * окна и есть путь раскрытия: обёртка уезжает вверх, приколотая секция стоит, и
 * отношение пройденного к общему пути даёт долю от 0 до 1.
 *
 * Единица — конец прохода: последний кадр клипа и одновременно момент, когда
 * следующая секция встаёт под шапку. Приколотая часть занимает первую половину пути
 * (`pinEnds`), вторую экран уходит вверх.
 *
 * **Прокрутка здесь — спусковой крючок, а не ручка.** Жест запускает доигрывание, и
 * раскрытие идёт до конца само (`HeroVideo`). Причина не в удобстве, а в целостности
 * приёма: при свободном отматывании посетитель останавливался посреди раскрытия, и
 * первый экран оставался полуоткрытым занавесом — кадром, которого в замысле нет.
 *
 * Модуль намеренно не знает ни про видео, ни про вуаль: он отвечает на три вопроса
 * — где обёртка, какая доля пройдена и толкнул ли посетитель страницу. Кто и как на
 * это реагирует, решают компоненты.
 */

'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Атрибут обёртки первого экрана. Роли внутри неё ищутся `closest`, а не по
 * классу: класс — это оформление, и его переименование не должно молча ломать
 * движение.
 */
export const HERO_STAGE_ATTRIBUTE = 'data-hero-stage';

/** Обёртка первого экрана, внутри которой лежит узел. */
export function heroStageOf(node: HTMLElement | null): HTMLElement | null {
  return node?.closest<HTMLElement>(`[${HERO_STAGE_ATTRIBUTE}]`) ?? null;
}

/**
 * Геометрия прохода первого экрана.
 *
 * `travel` — весь путь: от касания верхней кромки окна до момента, когда следующая
 * секция встаёт под шапку. Именно он, а не полоса разгона, служит знаменателем доли
 * раскрытия: последний кадр клипа обязан совпасть с приходом второй секции, а не
 * случиться раньше и ждать отдельного доезда.
 */
export interface HeroStageGeometry {
  /** Положение прокрутки, при котором обёртка касается верхней кромки окна. */
  top: number;
  /** Весь путь прохода в пикселях. */
  travel: number;
  /** Доля пути, на которой заканчивается приколотая часть. */
  pinEnds: number;
}

export function heroStageGeometry(stage: HTMLElement): HeroStageGeometry {
  const rect = stage.getBoundingClientRect();
  const top = window.scrollY + rect.top;
  const travel = Math.max(rect.height, 1);
  return {
    top,
    travel,
    pinEnds: Math.max(rect.height - window.innerHeight, 0) / travel,
  };
}

/** Доля пройденного пути прохода. */
export function heroRevealProgress(stage: HTMLElement): number {
  const { top, travel } = heroStageGeometry(stage);
  return Math.min(Math.max((window.scrollY - top) / travel, 0), 1);
}

/**
 * Подписка на прогресс раскрытия.
 *
 * `onProgress` вызывается на кадре анимации, а не на каждое событие прокрутки:
 * событий приходят десятки в секунду, а нарисовать браузер может один кадр.
 *
 * При `enabled === false` подписки нет вовсе и `onProgress` вызывается один раз с
 * нулём — это состояние «раскрытия не будет», а не «раскрытие на нуле по
 * случайности»: подписчики обязаны привести себя к закрытому виду.
 *
 * `onProgress` обязан быть стабильным (`useCallback`): он входит в зависимости
 * подписки, и новая функция на каждый рендер пересоздавала бы слушателей прокрутки.
 * Это не спрятано за ссылкой намеренно — с ссылкой такая ошибка работает молча и
 * всплывает потерянными кадрами, а так она видна сразу.
 */
export function useHeroRevealProgress(
  nodeRef: RefObject<HTMLElement | null>,
  onProgress: (progress: number) => void,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) {
      onProgress(0);
      return;
    }

    const stage = heroStageOf(nodeRef.current);
    if (!stage) return;

    let frame = 0;

    const read = () => {
      frame = 0;
      onProgress(heroRevealProgress(stage));
    };

    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [enabled, nodeRef, onProgress]);
}

/** Плавная кривая доезда прокрутки: без рывка на старте и без удара в конце. */
export function heroRevealEasing(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Направление жеста прокрутки. */
export type HeroGestureDirection = 'forward' | 'backward';

/**
 * Хука для жестов здесь больше нет — только тип.
 *
 * Он был: пассивные слушатели `wheel`, `touchmove` и клавиш, сообщавшие о направлении.
 * Пассивность и оказалась дефектом. Браузер применяет прокрутку, НЕ дожидаясь
 * пассивного слушателя, поэтому при резком жесте страница успевала уехать раньше, чем
 * начинался проход, и первый же кадр возвращал её назад — заметный рывок, и только на
 * обратном проходе, потому что вперёд обе силы тянут в одну сторону.
 *
 * Перехват должен ОТМЕНЯТЬ событие, а значит быть неактивным (`passive: false`), а
 * значит не обращаться к вёрстке — браузер ждёт его перед прокруткой. Оба требования
 * выполнимы только там, где уже есть и фаза прохода, и кешированная геометрия, то есть
 * в `HeroVideo`. Разделять это на хук и компонент означало бы передавать между ними
 * состояние на каждое событие колеса.
 */
