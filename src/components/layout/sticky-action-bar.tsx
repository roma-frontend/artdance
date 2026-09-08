/**
 * STICKY ACTION BAR — итог и главное действие, закреплённые снизу на телефоне.
 *
 * Зачем: на детальной странице панель брони — это правая колонка (`.detail-grid`
 * делает её `sticky`). На узком экране колонка схлопывается под содержимое, и
 * кнопка «забронировать» уезжает под три экрана описания и отзывов. Человек,
 * решившийся на середине страницы, обязан иметь возможность нажать сразу.
 *
 * Почему не «просто position: fixed»:
 *
 * • **Внизу уже стоит мобильный док** (`.has-mobile-dock`). Панель поднимается
 *   над ним на высоту дока, иначе кнопка накрывает вкладки навигации.
 * • **Safari на iOS**: нижняя строка браузера перекрывает фиксированный элемент,
 *   поэтому нужен `env(safe-area-inset-bottom)` — он уже учтён в утилите
 *   `.above-mobile-dock`.
 * • **Дублирование действия.** Кнопка в панели и кнопка в правой колонке — одно и
 *   то же действие; на широком экране панель скрыта, поэтому двух одинаковых
 *   кнопок на экране никогда не бывает.
 */

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface StickyActionBarProps {
  /** Левая часть: цена, «осталось мест», выбранное время. */
  summary: ReactNode;
  /** Правая часть: одна кнопка. Две кнопки в строке на 360px не помещаются. */
  action: ReactNode;
  className?: string;
}

export function StickyActionBar({ summary, action, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        /* Только там, где правая колонка схлопнута: на десктопе действие в ней. */
        'above-mobile-dock-flush fixed inset-x-0 z-sticky lg:hidden',
        'flex items-center gap-3 border-t border-border-default bg-surface-card px-4 py-3',
        'shadow-lg',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{summary}</div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
