/**
 * FACT LIST — список утверждений с отметкой.
 *
 * Условия комиссии, требования к преподавателю, правила подарочной карты: строки,
 * каждая из которых — законченный факт. Не карточки (у факта нет заголовка) и не
 * шаги (порядок не важен), поэтому это отдельный маленький блок, а не вариант
 * `ValueGrid` с четырьмя необязательными пропсами.
 *
 * Отметка декоративна: смысл в тексте. Вариант `tone` отличает «что вы получаете»
 * от «что мы просим» — второе не должно выглядеть как обещание.
 */

import { CheckIcon, InfoIcon, MinusIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface FactItem {
  id: string;
  text: ReactNode;
}

interface FactListProps {
  items: readonly FactItem[];
  /** `check` — преимущество, `info` — условие, `neutral` — просто перечисление. */
  tone?: 'check' | 'info' | 'neutral';
  columns?: 1 | 2;
  onCinema?: boolean;
  className?: string;
}

const icons = { check: CheckIcon, info: InfoIcon, neutral: MinusIcon } as const;

export function FactList({
  items,
  tone = 'check',
  columns = 1,
  onCinema = false,
  className,
}: FactListProps) {
  const Icon = icons[tone];

  return (
    <ul className={cn('flex flex-col gap-3', columns === 2 && 'md:grid md:grid-cols-2', className)}>
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
              tone === 'check' && (onCinema ? 'bg-accent-on-cinema/20' : 'bg-accent-soft'),
              tone !== 'check' && (onCinema ? 'bg-content-on-cinema/10' : 'bg-surface-sunken'),
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                'size-3',
                tone === 'check'
                  ? onCinema
                    ? 'text-content-on-cinema'
                    : 'text-content-accent'
                  : onCinema
                    ? 'text-content-on-cinema-muted'
                    : 'text-content-tertiary',
              )}
            />
          </span>

          <span
            className={cn(
              'text-body-sm',
              onCinema ? 'text-content-on-cinema-muted' : 'text-content-secondary',
            )}
          >
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
