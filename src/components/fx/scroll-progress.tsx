/**
 * SCROLL PROGRESS — полоса прочитанного вдоль нижней кромки компактного header.
 *
 * Как в Desktop/office (landing/Navbar.tsx):
 * • внешний декоративный слой — `absolute inset-0 overflow-hidden [border-radius:inherit]`
 *   клипает полосу по скруглению острова на ПОЛНОЙ высоте карточки (не узкой
 *   2px-полосой — иначе браузер схлопывает углы к 1px и старт выглядит прямым);
 *   только этот слоисто-clipped слой — dropdown-ы Locale/Lite остаются visible;
 * • внутренняя полка `scroll-progress-inner` — `inset-x-0 bottom-0 h-2/3px` с
 *   margin-inline как у page-container;
 * • сам бар — прямоугольный `w-full h-2/3px` со `scaleX(progress)` (как в office);
 *   кривой старт даёт внешний `inset-0` clip с `[border-radius:inherit]`, а не pill-скругление;
 *   узкая 2px полоса не может иметь свой радиус — клип только полноразмерным слоем.
 *
 * **Без JavaScript.** Прогресс чтения — это доля прокрутки документа, и её
 * умеет считать сам браузер: `animation-timeline: scroll(root block)` привязывает
 * анимацию к прогрессу прокрутки, и полоса движется на композиторе, не
 * занимая главный поток ничем. Класс `.scroll-progress-native` объявлен в
 * `globals.css` под `@supports (animation-timeline: scroll())`; там же
 * объяснение выбора `transform`. Явный root нужен из-за overflow у шапки.
 *
 * Скрипт остаётся для двух вещей, которых у нативной дорожки нет: спрятать
 * полосу на короткой странице и обновить прогресс через общий scroll-движок,
 * когда браузер анимацию не поддерживает.
 */

'use client';

import { useEffect, useRef } from 'react';

import { motion } from '@/design/motion';
import { registerScrollEffect } from '@/lib/animations/scroll-engine';
import { cn } from '@/lib/utils';

/**
 * Поддерживает ли браузер анимации от прокрутки.
 *
 * Проверка на `CSS.supports`, а не на присутствие `scroll()`: строка
 * `animation-timeline` разбирается и там, где значение не понимают, поэтому
 * `CSS.supports('animation-timeline', 'scroll(root block)')` — единственный честный
 * ответ. Тот же вопрос задаёт `@supports` в CSS, и оба обязаны совпасть.
 */
function supportsScrollTimeline(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'scroll(root block)');
}

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const native = supportsScrollTimeline();
    // Явный режим позволяет проверить fallback в браузере с поддержкой timeline.
    node.dataset.scrollDriver = native ? 'native' : 'script';
    let opacity = '';
    let transform = '';
    let frame = 0;

    /**
     * Единственная величина, которую считает скрипт: страница достаточно
     * длинная, чтобы у полосы был ход. Пересчитывается при изменении высоты
     * документа, а не на каждом событии прокрутки: высота меняется от
     * подгрузки изображений и раскрытия блоков, прокрутка на неё не влияет.
     */
    const read = () => {
      const documentHeight = document.documentElement.scrollHeight;
      const shortPage = documentHeight < window.innerHeight * motion.scrollProgress.minPageHeightFactor;
      opacity = shortPage ? '0' : '1';
      if (!native) {
        /* Запасной путь: без нативной дорожки полосу двигает скрипт. */
        const scrollable = documentHeight - window.innerHeight;
        const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
        transform = `scaleX(${progress})`;
      }
    };

    const write = () => {
      if (node.style.opacity !== opacity) node.style.opacity = opacity;
      if (!native && node.style.transform !== transform) node.style.transform = transform;
    };

    // Fallback использует общие фазы чтения/записи, а не работу на каждом event.
    if (!native) return registerScrollEffect({ read, write });

    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        read();
        write();
      });
    };
    schedule();

    /** Высота страницы меняется от подгрузки изображений и раскрытия блоков. */
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    observer.observe(document.body);
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      data-slot="scroll-progress"
      className={cn(
        'scroll-progress-native pointer-events-none absolute inset-0 origin-left',
        'bg-gradient-to-r from-accent to-metal',
        'rounded-full',
        'transition-opacity duration-(--scroll-progress-transition) ease-linear',
      )}
      /*
       * Начальное состояние задано тем же свойством, которым его меняет скрипт.
       * Через утилиту `scale-x-0` не получится: в Tailwind v4 она пишет в
       * отдельное CSS-свойство `scale`, а не в `transform`, — и полоса на каждой
       * загрузке страницы успевала мигнуть на всю ширину, прежде чем `transform`
       * из скрипта доезжал до нуля. Там, где прокрутку ведёт браузер, стартовое
       * значение перекрывает анимация — она приоритетнее инлайнового стиля.
       * rounded-full — pill 1.5px радиус при высоте 3px: в island левый край дополнительно клипает внешний inset-0 [border-radius:inherit] (как в office), в full gutter-режиме pill даёт кривой старт/конец без опила на clip.
       */
      style={{ transform: 'scaleX(0)' }}
    />
  );
}
