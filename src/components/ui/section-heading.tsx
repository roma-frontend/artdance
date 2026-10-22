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

import { TextReveal } from '@/components/fx/text-reveal';
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
  parallax?: boolean;
  /**
   * Раскрытие заголовка маской снизу вверх при входе в окно.
   *
   * Включается только там, где заголовок НЕ обёрнут в `Reveal`: иначе два
   * движения складываются — блок въезжает снизу и одновременно раскрывается
   * маской, и это читается как дефект отрисовки, а не как приём.
   *
   * На главной так и сделано: обёртки `Reveal` сняты, маска включена — одно
   * движение на секцию. На остальных страницах обёртки остались, и флаг там
   * не передаётся.
   */
  revealMask?: boolean;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  level = 2,
  align = 'left',
  onCinema = false,
  className,
  parallax = false,
  revealMask = false,
}: SectionHeadingProps) {
  const Title = `h${level}` as 'h2' | 'h3' | 'h4';

  return (
    <header
      data-parallax={parallax ? 'content' : undefined}
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

      {/*
        `data-reveal-mask` — раскрытие заголовка снизу вверх при входе в окно.
        Единственное движение появления на секциях главной: тело секции стоит на
        месте, взгляд ведёт заголовок. Считает браузер (`animation-timeline:
        view()`), без JS-обработчика прокрутки и с поддержкой работы без
        JavaScript; правила — в `globals.css`, рядом с объяснением, почему
        четырнадцать одинаковых `Reveal` были заменены одним жестом.
      */}
      <Title
        data-parallax={parallax ? 'heading' : undefined}
        data-reveal-mask={revealMask ? '' : undefined}
        className={cn('text-heading-2', onCinema && 'text-content-on-cinema')}
      >
        {revealMask ? (
          <span data-reveal-mask-content="">{title}</span>
        ) : typeof title === 'string' ? <TextReveal>{title}</TextReveal> : title}
      </Title>

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
