/**
 * REVEAL — появление блока при попадании в область просмотра.
 *
 * Три решения, которые отличают это от `.reveal` в прототипе.
 *
 * **1. Скрытое состояние живёт в CSS под условием, а не безусловно.** В макете
 * `.reveal { opacity: 0 }` объявлено статически: при выключенном JavaScript
 * наблюдатель не запускается и страница остаётся пустой — это потеря контента,
 * а не потеря анимации. Наши правила (`tokens.css`) обёрнуты в
 * `@media (scripting: enabled) and (prefers-reduced-motion: no-preference)`,
 * поэтому и без JS, и при просьбе убрать движение блок сразу виден.
 *
 * **2. Один наблюдатель на страницу, а не по одному на блок.** Секций на
 * лендинге больше десяти; отдельный `IntersectionObserver` на каждую — это
 * десяток независимых подписок с одинаковыми параметрами. Наблюдатель здесь
 * общий и создаётся при первом использовании.
 *
 * **3. Появление не вызывает повторный рендер.** Атрибут `data-revealed`
 * ставится прямо на узел, а не через состояние React: это чисто визуальный
 * факт, за которым не следует никакая логика. Рендер целой секции ради смены
 * атрибута — работа, которую видно в профайлере на слабом телефоне.
 *
 * Дети остаются серверными компонентами: клиентской является только обёртка.
 */

'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { cn } from '@/lib/utils';

/** `stagger` — не направление, а режим: двигаются дети, а не сам контейнер. */
export type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'stagger';

const REVEALED = 'data-revealed';

let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  sharedObserver ??= new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute(REVEALED, '');
        /** Появление однократное — повтор при обратной прокрутке мешает читать. */
        if (motion.reveal.once) observer.unobserve(entry.target);
      }
    },
    {
      threshold: motion.reveal.threshold,
      /** Запуск, когда блок вошёл в экран, а не в момент касания края. */
      rootMargin: `0px 0px ${motion.reveal.rootMarginBottomPx}px 0px`,
    },
  );
  return sharedObserver;
}

interface RevealProps {
  children: ReactNode;
  variant?: RevealVariant;
  /** Тег обёртки: секции нужен `section`, элементу списка — `li`. */
  as?: ElementType;
  className?: string;
}

export function Reveal({ children, variant = 'up', as: Component = 'div', className }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    /*
     * При просьбе убрать движение CSS ничего не скрывает, поэтому наблюдать
     * не за чем — не тратим на это ни подписку, ни вычисление пересечений.
     */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /*
     * Блок, уже находящийся в области просмотра при загрузке (первый экран),
     * получит `isIntersecting` в первом же колбэке наблюдателя — отдельная
     * проверка не нужна.
     */
    const observer = getObserver();
    observer.observe(node);
    return () => observer.unobserve(node);
  }, []);

  const attributes =
    variant === 'stagger' ? { 'data-stagger': '' } : { 'data-reveal': variant };

  return (
    <Component ref={ref} className={cn(className)} {...attributes}>
      {children}
    </Component>
  );
}
