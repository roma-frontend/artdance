/**
 * STEP LIST — «как это работает» нумерованными шагами.
 *
 * Нумерация — `<ol>`, а не цифры в разметке: порядок здесь смысловой, и
 * скринридер обязан объявить «шаг 2 из 4», а не прочитать нарисованную двойку.
 * Сами цифры в кружках декоративны и берутся из счётчика CSS через `::before`
 * невозможно — поэтому индекс приходит из данных, а не из вёрстки.
 *
 * Линия между шагами — псевдоэлемент, как в таймлайне опыта инструктора: одна
 * утилита вместо отдельного элемента-полоски, который на последнем шаге пришлось
 * бы прятать условием.
 */

import type { ReactNode } from 'react';

import { Reveal } from '@/components/fx/reveal';
import { cn } from '@/lib/utils';

export interface StepItem {
  id: string;
  title: ReactNode;
  body: ReactNode;
}

interface StepListProps {
  items: readonly StepItem[];
  /** Горизонтально — для четырёх коротких шагов; вертикально — для длинных. */
  layout?: 'row' | 'column';
  onCinema?: boolean;
  className?: string;
}

export function StepList({ items, layout = 'row', onCinema = false, className }: StepListProps) {
  return (
    <Reveal
      as="ol"
      variant="stagger"
      className={cn(
        layout === 'row' ? 'grid gap-6 xs:grid-cols-2 lg:grid-cols-4' : 'flex flex-col gap-8',
        className,
      )}
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            'relative',
            /*
             * Вертикальная раскладка: соединительная линия от номера вниз. У
             * последнего шага её нет — иначе таймлайн выглядит незаконченным.
             */
            layout === 'column' &&
              'ps-12 before:absolute before:inset-y-0 before:start-4.5 before:w-px last:before:hidden',
            layout === 'column' && (onCinema ? 'before:bg-border-on-cinema' : 'before:bg-border-default'),
          )}
        >
          <span
            className={cn(
              'text-caption flex size-9 items-center justify-center rounded-full font-semibold',
              layout === 'column' && 'absolute start-0 top-0',
              onCinema
                ? 'bg-content-on-cinema/10 text-content-on-cinema'
                : 'bg-accent-soft text-content-accent',
            )}
          >
            {/* Номер декоративен: порядок уже объявлен разметкой `<ol>`. */}
            <span aria-hidden>{index + 1}</span>
          </span>

          <h3
            className={cn(
              'text-card-title',
              layout === 'row' && 'mt-4',
              onCinema && 'text-content-on-cinema',
            )}
          >
            {item.title}
          </h3>

          <p
            className={cn(
              'text-body-sm mt-2',
              onCinema ? 'text-content-on-cinema-muted' : 'text-content-secondary',
            )}
          >
            {item.body}
          </p>
        </li>
      ))}
    </Reveal>
  );
}
