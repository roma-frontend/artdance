/**
 * VALUE GRID — сетка «заголовок + абзац».
 *
 * Ценности платформы, выгоды для преподавателя, темы справки, условия подарочной
 * карты — всё это один и тот же блок: три-четыре карточки, в каждой короткий
 * заголовок и два предложения. Разные страницы отличаются содержимым, а не
 * вёрсткой.
 *
 * Иконка необязательна и всегда декоративна (`aria-hidden`): смысл несёт
 * заголовок. Иконка-эмодзи из прототипа заменена на `lucide-react` — эмодзи
 * скринридер читает вслух («улыбающееся лицо») посреди делового текста.
 *
 * Карточка становится ссылкой, только если у элемента есть `href`. Тогда
 * кликабельна вся карточка, а не подпись: цель размером в карточку попадается
 * пальцем, цель размером в слово — нет.
 */

import type { LucideIcon } from 'lucide-react';
import { ArrowRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Reveal } from '@/components/fx/reveal';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export interface ValueItem {
  id: string;
  title: ReactNode;
  body: ReactNode;
  icon?: LucideIcon;
  /** Путь без префикса локали. Делает карточку ссылкой. */
  href?: string;
  /** Подпись действия. Обязательна вместе с `href`: ссылка называет, куда ведёт. */
  linkLabel?: ReactNode;
}

interface ValueGridProps {
  items: readonly ValueItem[];
  columns?: 2 | 3 | 4;
  onCinema?: boolean;
  className?: string;
}

export function ValueGrid({ items, columns = 3, onCinema = false, className }: ValueGridProps) {
  return (
    <Reveal
      as="ul"
      variant="stagger"
      className={cn(
        'grid gap-5',
        columns === 2 && 'md:grid-cols-2',
        columns === 3 && 'xs:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'xs:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.id} className="flex">
          <Card item={item} onCinema={onCinema} />
        </li>
      ))}
    </Reveal>
  );
}

function Card({ item, onCinema }: { item: ValueItem; onCinema: boolean }) {
  const Icon = item.icon;

  const body = (
    <>
      {Icon && (
        <Icon
          aria-hidden
          className={cn('mb-4 size-6', onCinema ? 'text-metal' : 'text-content-accent')}
        />
      )}

      <h3 className={cn('text-card-title', onCinema && 'text-content-on-cinema')}>{item.title}</h3>

      <p
        className={cn(
          'text-body-sm mt-2',
          onCinema ? 'text-content-on-cinema-muted' : 'text-content-secondary',
        )}
      >
        {item.body}
      </p>

      {item.linkLabel !== undefined && (
        <span
          className={cn(
            'text-caption mt-4 inline-flex items-center gap-1.5 font-semibold',
            onCinema ? 'text-content-on-cinema' : 'text-content-accent',
          )}
        >
          {item.linkLabel}
          <ArrowRightIcon aria-hidden className="size-3.5 transition-transform duration-normal ease-brand group-hover:translate-x-1 rtl:rotate-180" />
        </span>
      )}
    </>
  );

  const shell = cn(
    'flex h-full flex-col rounded-lg border p-6',
    onCinema
      ? 'border-border-on-cinema bg-content-on-cinema/5'
      : 'border-border-default bg-surface-card',
  );

  if (item.href === undefined) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link
      href={item.href}
      className={cn(
        shell,
        'group transition-all duration-normal ease-brand',
        onCinema
          ? 'hover:border-accent-on-cinema'
          : 'hover:-translate-y-0.5 hover:border-accent hover:shadow-md',
      )}
    >
      {body}
    </Link>
  );
}
