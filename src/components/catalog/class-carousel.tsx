/**
 * CLASS CAROUSEL — горизонтальная лента карточек со snap и кнопками.
 *
 * Нативная прокрутка со `scroll-snap`, а не библиотека: у браузера уже есть
 * инерция, поддержка тачпада, клавиатуры и `prefers-reduced-motion`. Пакет
 * карусели (embla) был добавлен и удалён именно поэтому — он повторял то, что
 * работает само, и добавлял 12 KB в бандл.
 *
 * Доступность, которой в прототипе нет:
 *   • кнопки имеют имена и `aria-controls` — в макете это безымянные круги
 *     с символом, и скринридер читает их как «кнопка»;
 *   • лента фокусируема (`tabIndex`), поэтому список прокручивается стрелками
 *     клавиатуры (WCAG 2.1.1). Без этого до правых карточек не добраться иначе
 *     как табом через все ссылки;
 *   • кнопки гасятся на краях, а не молча ничего не делают.
 *
 * Перетаскивание мышью из прототипа не переносится: чтобы отличить перетаскивание
 * от клика, приходится подавлять переход по ссылке после сдвига, и цена ошибки —
 * карточка, которая иногда не открывается. Колесо, тачпад, палец, стрелки и
 * кнопки покрывают все способы прокрутки.
 */

'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { cn } from '@/lib/utils';

interface ClassCarouselProps {
  /** Элементы `<li>`: карусель не знает, что внутри. */
  children: ReactNode;
  /** Название ленты для скринридера. */
  label: string;
  className?: string;
}

export function ClassCarousel({ children, label, className }: ClassCarouselProps) {
  const t = useTranslations('a11y');
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  /** Лента короче контейнера — кнопки не нужны вовсе. */
  const [scrollable, setScrollable] = useState(false);

  /**
   * Шаг прокрутки — ширина карточки с промежутком, а не константа: на разных
   * ширинах экрана карточка разная, и фиксированный шаг оставлял бы её
   * наполовину за краем. Значение из `motion.carousel` служит запасом, если
   * список пуст.
   */
  const step = useCallback((): number => {
    const node = listRef.current;
    const first = node?.firstElementChild as HTMLElement | null;
    if (!node || !first) return motion.carousel.stepPx;

    const gap = Number.parseFloat(window.getComputedStyle(node).columnGap) || 0;
    return first.offsetWidth + gap;
  }, []);

  const syncEdges = useCallback(() => {
    const node = listRef.current;
    if (!node) return;

    const { edgeTolerancePx, minHiddenStepRatio } = motion.carousel;
    const maxScroll = node.scrollWidth - node.clientWidth;

    /*
     * Кнопки нужны, только если скрыто заметное количество контента. Иначе на
     * широком экране лента, обрезанная на пару десятков пикселей, получала бы
     * две кнопки, каждая из которых почти ничего не делает.
     */
    setScrollable(maxScroll > Math.max(edgeTolerancePx, step() * minHiddenStepRatio));
    setAtStart(node.scrollLeft <= edgeTolerancePx);
    setAtEnd(node.scrollLeft >= maxScroll - edgeTolerancePx);
  }, [step]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    syncEdges();
    node.addEventListener('scroll', syncEdges, { passive: true });

    /** Ширина карточек зависит от контейнера: следим за изменением размера. */
    const observer = new ResizeObserver(syncEdges);
    observer.observe(node);

    return () => {
      node.removeEventListener('scroll', syncEdges);
      observer.disconnect();
    };
  }, [syncEdges]);

  const scrollBy = useCallback(
    (direction: -1 | 1) => {
      listRef.current?.scrollBy({
        left: direction * step(),
        behavior: motion.carousel.behavior,
      });
    },
    [step],
  );

  return (
    <div className={cn('relative', className)}>
      <ul
        ref={listRef}
        id={listId}
        /*
         * `group` с именем роли: лента — это регион с собственным содержимым,
         * и скринридер должен объявить её название перед перечислением карточек.
         */
        role="group"
        aria-label={label}
        tabIndex={0}
        className={cn(
          'scrollbar-none flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4',
          'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus',
        )}
      >
        {children}
      </ul>

      {scrollable && (
        <div className="mt-3 flex justify-end gap-2">
          <CarouselArrow
            direction="previous"
            controls={listId}
            disabled={atStart}
            label={t('carouselPrevious')}
            onClick={() => scrollBy(-1)}
          />
          <CarouselArrow
            direction="next"
            controls={listId}
            disabled={atEnd}
            label={t('carouselNext')}
            onClick={() => scrollBy(1)}
          />
        </div>
      )}
    </div>
  );
}

interface CarouselArrowProps {
  direction: 'previous' | 'next';
  controls: string;
  disabled: boolean;
  label: string;
  onClick: () => void;
}

function CarouselArrow({ direction, controls, disabled, label, onClick }: CarouselArrowProps) {
  const Icon = direction === 'previous' ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-controls={controls}
      className={cn(
        'grid size-10 place-items-center rounded-full',
        'border border-border-default bg-surface-card text-content-primary',
        'transition-[transform,border-color,color] duration-normal ease-brand',
        'hover:border-accent hover:text-accent hover:scale-105 active:scale-95',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
