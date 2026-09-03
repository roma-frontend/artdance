/**
 * SECTION HEADING — надзаголовок, заголовок и подзаголовок секции (`.sec-h`).
 *
 * Один компонент вместо шести классов в каждой секции. Кроме единообразия он
 * решает две вещи, которые в разметке легко нарушить:
 *
 * • **уровень заголовка задаётся явно.** На главной секции идут вторым уровнем,
 *   а внутри карточной страницы тот же блок может быть третьим. Скачок уровней
 *   (`h2` → `h4`) — стандартная претензия аудита доступности, и здесь она
 *   исключена типом `level`;
 * • **подзаголовок необязателен и не создаёт пустой `<p>`.** Пустой абзац
 *   ломает вертикальный ритм и читается скринридером как пауза.
 *
 * Декоративная золотая черта перед надзаголовком — псевдоэлемент `.eyebrow-rule`
 * в `globals.css`: из JSX его не выразить, а группа утилит на каждый вызов
 * читалась бы хуже одной строки CSS.
 */

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  /** Надзаголовок: `Discover`, `Meet the Masters`. Необязателен. */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Уровень заголовка в структуре страницы. */
  level?: 2 | 3 | 4;
  align?: 'left' | 'center';
  /** Тёмная кинематографичная секция: цвета контента меняются на светлые. */
  onCinema?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  level = 2,
  align = 'left',
  onCinema = false,
  className,
}: SectionHeadingProps) {
  const Title = `h${level}` as 'h2' | 'h3' | 'h4';

  return (
    <header
      className={cn(
        'mb-12 max-w-(--layout-content-max-width)',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow !== undefined && (
        <p
          className={cn(
            'eyebrow-rule text-eyebrow mb-3',
            onCinema ? 'text-metal' : 'text-content-accent',
            align === 'center' && 'justify-center',
          )}
        >
          {eyebrow}
        </p>
      )}

      <Title className={cn('text-heading-2', onCinema && 'text-content-on-cinema')}>{title}</Title>

      {subtitle !== undefined && (
        <p
          className={cn(
            'text-body mt-3',
            onCinema ? 'text-content-on-cinema-muted' : 'text-content-secondary',
          )}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}
