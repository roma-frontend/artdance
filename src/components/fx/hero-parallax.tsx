/**
 * HERO PARALLAX — обёртка первого экрана: полоса разгона и плотность вуали.
 *
 * До 05.09.2026 здесь был перенесённый из прототипа уход экрана вверх: фон уезжал
 * медленнее содержимого, содержимое гасло, затемнение растворялось — всё от
 * `window.scrollY` в пикселях. Первый экран заменён на раскрытие занавеса
 * прокруткой, и прежняя механика к нему неприменима: экран не уезжает, он приколот
 * к верху окна, пока прокрутка отматывает клип.
 *
 * **Слои первого экрана больше не двигаются и не гаснут** — решение заказчика:
 * заголовок, кнопки и показатели видны до конца раскрытия. Ход текста читался как
 * отдельное движение, спорящее с раскрытием: занавес открывается, а надпись зачем-то
 * ползёт.
 *
 * Отсюда единственная работа этого компонента, и она не косметическая. Текст,
 * который остаётся на виду, к концу раскрытия оказывается на ОТКРЫТОЙ СЦЕНЕ —
 * самой светлой части кадра. В начале за ним почти абсолютно чёрный бархат
 * (замерено по столбцам яркости: 0 до 54% ширины кадра), и вуаль там почти не
 * нужна; к концу без вуали ivory-заголовок теряет контраст. Поэтому вуаль не
 * растворяется, а густеет: от `overlayOpacityAtStart` до полной к
 * `overlayFullAtProgress` раскрытия.
 *
 * Роль назначается атрибутом `data-parallax` на самом элементе, а не селектором по
 * классу: разметка первого экрана живёт в серверном компоненте страницы, и
 * связывать её с эффектом именем класса означало бы, что переименование класса
 * молча ломает движение.
 *
 * Стили пишутся прямо в узлы, минуя состояние React: прокрутка даёт десятки
 * событий в секунду. При `prefers-reduced-motion` подписки нет, и вуаль остаётся в
 * начальной плотности — на экране в этом случае постер с закрытым занавесом, то
 * есть почти чёрный кадр, и держать текст на нём нужно ровно столько же, сколько в
 * начале раскрытия.
 */

'use client';

import { useCallback, useRef, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { HERO_STAGE_ATTRIBUTE, useHeroRevealProgress } from '@/lib/hooks/use-hero-reveal';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

/**
 * Роль элемента первого экрана. Значение атрибута `data-parallax`.
 *
 * Роли `background` и `content` больше нет. Кадр не двигается независимо от секции
 * — он раскрывается, и этим управляет сам `HeroVideo`; прежде фон получал здесь
 * `scale` от прокрутки, и вместе с хвостовым укрупнением кадра это дало бы
 * шестнадцатикратное растягивание пикселей к концу разгона. Содержимое не
 * двигается и не гаснет вовсе.
 */
export type HeroParallaxRole = 'overlay';

export function HeroParallax({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const onProgress = useCallback((progress: number) => {
    const root = rootRef.current;
    if (!root) return;

    const { overlayOpacityAtStart, overlayFullAtProgress } = motion.heroParallax;

    const density = Math.min(progress / overlayFullAtProgress, 1);
    const opacity = overlayOpacityAtStart + (1 - overlayOpacityAtStart) * density;

    const role: HeroParallaxRole = 'overlay';
    for (const element of root.querySelectorAll<HTMLElement>(`[data-parallax="${role}"]`)) {
      element.style.opacity = opacity.toFixed(3);
    }
  }, []);

  useHeroRevealProgress(rootRef, onProgress, !reducedMotion);

  /*
   * Обёртка получает класс снаружи: первый экран и поисковая строка образуют одну
   * вертикаль (`.hero-viewport`), а полосу разгона задаёт `.hero-stage` — и
   * растягиваться должен именно этот узел.
   *
   * Атрибут обёртки нужен подписчикам прогресса: они находят её через `closest`, а
   * не по классу.
   */
  return (
    <div ref={rootRef} className={className} {...{ [HERO_STAGE_ATTRIBUTE]: true }}>
      {children}
    </div>
  );
}
