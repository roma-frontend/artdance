/**
 * EMPTY STATE — пустое состояние списка.
 *
 * В прототипе пустых состояний нет ни одного — это самый частый пробел при
 * переносе макета в продукт: дизайнер рисует заполненный экран, а первый же
 * пользователь с узким фильтром видит пустоту без объяснений.
 *
 * Компонент обязателен для КАЖДОГО списка и всегда содержит две вещи:
 * объяснение, почему здесь пусто, и действие, которое это исправит. «Ничего не
 * найдено» без выхода — тупик: пользователю приходится догадываться, что
 * сбросить фильтр можно, и где.
 *
 * Иконка передаётся снаружи: у пустой корзины, пустого поиска и пустого
 * расписания разные смыслы, и подбирать их за вызывающего компонент нельзя.
 */

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Иконка из lucide, уже с нужным размером. Необязательна. */
  icon?: ReactNode;
  title: ReactNode;
  /** Почему пусто и что с этим делать. */
  description?: ReactNode;
  /** Кнопка или ссылка выхода из состояния. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      /*
       * `status`, а не просто div: список обновился без перезагрузки, и
       * скринридер обязан узнать, что результатов не осталось. `polite` —
       * потому что это следствие действия пользователя, а не авария.
       */
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl',
        'border border-dashed border-border-default bg-surface-raised',
        'px-6 py-16 text-center',
        className,
      )}
    >
      {icon !== undefined && <span className="text-content-tertiary">{icon}</span>}

      <p className="text-card-title text-content-primary">{title}</p>

      {description !== undefined && (
        <p className="text-body-sm max-w-(--layout-prose-max-width) text-content-secondary">
          {description}
        </p>
      )}

      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
}
