/**
 * CONTENT SECTION — секция контентной страницы.
 *
 * Восемь новых страниц (о нас, справка, лендинги, подарочные карты, документы)
 * состоят из одного и того же: полоса на всю ширину, внутри контейнер, сверху
 * заголовок, дальше содержимое. Без общего компонента этот каркас копируется
 * восемь раз, и через месяц ритм секций на «о нас» отличается от «стать
 * преподавателем» на одну ступень отступа — а заметно это только когда страницы
 * стоят рядом на приёмке.
 *
 * Компонент серверный: ни состояния, ни обработчиков здесь нет и быть не должно.
 *
 * Чередование фона — `tone`, а не класс по месту: полосы обязаны идти через одну,
 * и это свойство ПОСЛЕДОВАТЕЛЬНОСТИ секций. Страница выбирает тон осознанно,
 * а не «подкрашивает» отдельную секцию.
 */

import type { ReactNode } from 'react';

import { Reveal } from '@/components/fx/reveal';
import { SectionHeading } from '@/components/ui/section-heading';
import { cn } from '@/lib/utils';

export type ContentTone = 'canvas' | 'raised' | 'cinema';

interface ContentSectionProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Уровень заголовка. По умолчанию второй: на странице один `h1` — в баннере. */
  level?: 2 | 3;
  tone?: ContentTone;
  /** Тесная секция: для коротких блоков вроде примечаний и призыва к действию. */
  spacing?: 'default' | 'tight';
  align?: 'left' | 'center';
  /** Ограничить содержимое шириной удобной для чтения строки. */
  prose?: boolean;
  id?: string;
  children?: ReactNode;
  className?: string;
}

export function ContentSection({
  eyebrow,
  title,
  subtitle,
  level = 2,
  tone = 'canvas',
  spacing = 'default',
  align = 'left',
  prose = false,
  id,
  children,
  className,
}: ContentSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        spacing === 'tight' ? 'section-y-tight' : 'section-y',
        tone === 'raised' && 'bg-surface-raised',
        tone === 'cinema' && 'cinema-surface',
        className,
      )}
      /*
       * Якорь секции обязан отступать от прилипшей шапки: без этого переход по
       * ссылке из оглавления ставит заголовок ПОД шапку, и человек видит середину
       * абзаца. Значение — высота шапки из токенов, а не подобранное число.
       */
      style={id === undefined ? undefined : { scrollMarginTop: 'var(--layout-nav-height)' }}
    >
      <div className="page-container">
        {(eyebrow !== undefined || title !== undefined || subtitle !== undefined) && (
          <Reveal>
            <SectionHeading
              eyebrow={eyebrow}
              title={title ?? ''}
              subtitle={subtitle}
              level={level}
              align={align}
              onCinema={tone === 'cinema'}
              className={cn(children === undefined && 'mb-0', align === 'center' && 'mx-auto')}
            />
          </Reveal>
        )}

        {children !== undefined && (
          <div className={cn(prose && 'max-w-(--layout-prose-max-width)')}>{children}</div>
        )}
      </div>
    </section>
  );
}
