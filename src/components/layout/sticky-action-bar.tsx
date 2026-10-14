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
 * • **Внизу уже стоит мобильный док** (`.has-mobile-dock`). Панель становится
 *   отдельной плавающей карточкой над ним, иначе кнопка накрывает вкладки
 *   навигации и визуально слипается с доком.
 * • **Safari на iOS**: нижняя строка браузера перекрывает фиксированный элемент,
 *   поэтому нужен `env(safe-area-inset-bottom)` — он уже учтён в утилите
 *   `.above-mobile-dock-flush`.
 * • **Дублирование действия.** Кнопка в панели и кнопка в правой колонке — одно и
 *   то же действие; на широком экране панель скрыта, поэтому двух одинаковых
 *   кнопок на экране никогда не бывает.
 */

'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface StickyActionBarProps {
  /** Левая часть: цена, «осталось мест», выбранное время. */
  summary: ReactNode;
  /** Правая часть: одна кнопка. Две кнопки в строке на 360px не помещаются. */
  action: ReactNode;
  className?: string;
}

export function StickyActionBar({ summary, action, className }: StickyActionBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  /*
   * Высота панели зависит от локали и текста сводки. Резерв футера получает
   * безопасное значение из дизайн-токена до гидратации, а после первого layout
   * уточняется фактической высотой и продолжает следить за переносами строк.
   */
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const root = document.documentElement;
    const updateHeight = () => {
      root.style.setProperty(
        '--sticky-action-bar-height',
        `${bar.getBoundingClientRect().height}px`,
      );
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(bar);

    return () => {
      observer.disconnect();
      root.style.removeProperty('--sticky-action-bar-height');
    };
  }, []);

  return (
    <div
      ref={barRef}
      data-slot="sticky-action-bar"
      className={cn(
        /* Только там, где правая колонка схлопнута: на десктопе действие в ней. */
        'above-mobile-dock-flush fixed inset-x-3 z-sticky mx-auto max-w-md lg:hidden',
        'flex min-h-(--layout-sticky-action-bar-height) items-center gap-3 rounded-xl',
        'border border-border-default bg-surface-card/95 px-4 py-3 shadow-xl backdrop-blur-xl',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{summary}</div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
