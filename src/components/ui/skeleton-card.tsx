/**
 * СКЕЛЕТЫ — форма содержимого, которое сейчас появится.
 *
 * Главное требование к скелету: он повторяет ГЕОМЕТРИЮ финального блока. Скелет
 * «на глаз» даёт скачок вёрстки в момент подмены, и это ухудшает CLS сильнее, чем
 * его отсутствие. Поэтому размеры здесь взяты не произвольно, а из карточек и
 * таблицы, рядом с которыми они стоят: медиа 4:3 у карточки каталога, три
 * текстовые строки под ней, высота строки таблицы админки.
 *
 * Один `aria-busy` контейнер на группу, а не на каждую плитку: скринридер должен
 * услышать «загружается список», а не двенадцать раз «загружается».
 *
 * Мерцание — `animate-pulse` из `Skeleton`; при `prefers-reduced-motion` оно
 * гаснет, а серые блоки остаются: форма — это информация, а не украшение.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { motion } from '@/design/motion';
import { cn } from '@/lib/utils';

interface SkeletonGroupProps {
  /** Подпись для скринридера: «Загружается: занятия». */
  label: string;
  /** Сколько элементов рисовать. По умолчанию — из `motion.loading`. */
  count?: number;
  className?: string;
}

function Busy({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * Карточка каталога: кадр 4:3, заголовок, две строки подписи, цена.
 *
 * Пропорция та же, что у `Media preset` карточек, поэтому подмена не сдвигает
 * сетку ни на пиксель.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border border-border-default bg-surface-card p-3', className)}>
      <Skeleton className="aspect-4/3 w-full rounded-md" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex items-center justify-between gap-3 pt-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/** Сетка карточек каталога: та же, что в `/classes` — три колонки на широком. */
export function SkeletonCardGrid({ label, count, className }: SkeletonGroupProps) {
  const items = count ?? motion.loading.skeletonRows;

  return (
    <Busy label={label} className={className}>
      <div className="grid gap-5 xs:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: items }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </Busy>
  );
}

/** Список строк: кабинет, брони, заказы — там, где карточек нет. */
export function SkeletonList({ label, count, className }: SkeletonGroupProps) {
  const items = count ?? motion.loading.skeletonRows;

  return (
    <Busy label={label} className={className}>
      <ul className="flex flex-col gap-3">
        {Array.from({ length: items }, (_, index) => (
          <li
            key={index}
            className="flex items-center gap-4 rounded-md border border-border-default bg-surface-card p-4"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </li>
        ))}
      </ul>
    </Busy>
  );
}

interface SkeletonTableProps extends SkeletonGroupProps {
  /** Сколько колонок. По умолчанию — как у большинства списков админки. */
  columns?: number;
}

/**
 * Таблица админки.
 *
 * Высота строки и рамка совпадают с `DataTable`: у админки списки длинные, и
 * скачок на подмене здесь заметнее всего — страница успевает прокрутиться.
 */
export function SkeletonTable({ label, count, columns = 5, className }: SkeletonTableProps) {
  const rows = count ?? motion.loading.skeletonRows;

  return (
    <Busy
      label={label}
      className={cn('overflow-hidden rounded-lg border border-border-default bg-surface-card', className)}
    >
      <div className="flex items-center gap-4 border-b border-border-default px-4 py-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>

      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0"
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton key={columnIndex} className={cn('h-4 flex-1', columnIndex === 0 && 'flex-[2]')} />
          ))}
        </div>
      ))}
    </Busy>
  );
}
