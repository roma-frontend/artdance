/**
 * COUNTER — число, набегающее от нуля при появлении в области просмотра.
 *
 * Эффект из прототипа (`data-count` + `animC`), но с одним важным отличием:
 * **в разметку попадает итоговое число, а не нуль.**
 *
 * В макете в HTML стоит `0`, а настоящее значение живёт в атрибуте и появляется
 * только после запуска скрипта. Для пользователя без JavaScript и для
 * поискового робота на первом экране написано «0+ активных танцоров» — это не
 * потеря анимации, а потеря факта. Здесь сервер отдаёт готовое число, а анимация
 * лишь ненадолго заменяет его промежуточными значениями.
 *
 * Чтобы не показать «настоящее число → нуль → снова настоящее число» в момент
 * гидратации, стартовое состояние скрыто в CSS ровно теми же условиями, что и
 * появление секций: `@media (scripting: enabled) and (prefers-reduced-motion:
 * no-preference)` в `globals.css`. Пока скрипт не начал считать, показатель
 * невидим, но занимает своё место — сдвига раскладки нет, потому что итоговая
 * строка самая длинная из всех промежуточных. Без JavaScript и при просьбе
 * убрать движение правило не действует, и число видно сразу.
 *
 * Знак после числа («+») — часть этого же элемента, а не текст рядом: иначе на
 * время гидратации от «2 500+» на экране остаётся одинокий плюс.
 *
 * Форматирование — через локаль (`useFormatter`), а не `toLocaleString()` без
 * аргументов, как в макете: разделитель разрядов зависит от языка, и «4.9» в
 * армянской версии должно выглядеть так же, как все остальные рейтинги на сайте.
 *
 * Значение пишется прямо в DOM, минуя состояние React: кадров у анимации
 * несколько десятков, и ни один из них не повод рендерить дерево.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useFormatter } from 'next-intl';

import { motion } from '@/design/motion';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

interface CounterProps {
  value: number;
  /** Знаков после запятой. Рейтинг — 1, количества — 0. */
  decimals?: number;
  /** Знак после числа: «+», «%». */
  suffix?: string;
  /** Класс самого числа: у показателей hero оно золотое, а суффикс — нет. */
  className?: string;
}

export function Counter({ value, decimals = 0, suffix, className }: CounterProps) {
  /** Группа «число + знак»: её наблюдаем и с неё снимаем скрытие. */
  const groupRef = useRef<HTMLSpanElement>(null);
  /** Само число: только его текст меняется каждый кадр. */
  const numberRef = useRef<HTMLSpanElement>(null);
  /** Анимация запускается один раз: повтор при обратной прокрутке мешает читать. */
  const started = useRef(false);
  const format = useFormatter();
  const reducedMotion = usePrefersReducedMotion();

  const render = (current: number): string =>
    decimals > 0 ? format.number(current, 'rating') : format.number(Math.floor(current), 'plain');

  useEffect(() => {
    const group = groupRef.current;
    const number = numberRef.current;
    if (!group || !number || started.current) return;

    /*
     * Просьба убрать движение: показатель просто становится видимым. Атрибут
     * снимает то же правило, которое скрывало стартовое состояние.
     */
    if (reducedMotion) {
      started.current = true;
      group.setAttribute('data-counted', '');
      return;
    }

    const { durationMs, easingPower, threshold } = motion.counter;
    let frame = 0;

    const animate = () => {
      const start = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - start) / durationMs, 1);
        /** ease-out: рывок в начале, мягкая остановка — как в прототипе. */
        const eased = 1 - Math.pow(1 - progress, easingPower);
        number.textContent = render(value * eased);
        if (progress < 1) frame = window.requestAnimationFrame(tick);
      };

      /*
       * Обнулить и показать в одном кадре: пока элемент скрыт, «нуль» на экран
       * не попадает, а первый `tick` уже пишет растущее значение.
       */
      number.textContent = render(0);
      group.setAttribute('data-counted', '');
      frame = window.requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          started.current = true;
          animate();
        }
      },
      { threshold },
    );

    observer.observe(group);

    return () => {
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
    /* `render` пересобирается каждый рендер, но повторный запуск закрыт `started`. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, value, decimals]);

  return (
    <span ref={groupRef} data-counter>
      <span ref={numberRef} className={className}>
        {render(value)}
      </span>
      {suffix}
    </span>
  );
}
