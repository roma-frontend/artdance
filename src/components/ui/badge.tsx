/**
 * BADGE — метка: направление, уровень, статус, тренд, верификация.
 *
 * В прототипе это четыре разных класса с почти одинаковыми стилями (`.tag`,
 * `.cc-badge`, `.event-type`, `.inst-v`). Здесь один компонент с вариантами:
 * различие между ними — смысловая роль, а не набор отступов.
 *
 * Осознанно НЕ компонент shadcn/ui `badge`: его вариантная модель
 * (`default | secondary | destructive | outline`) описывает вид, а не роль, и в
 * ней негде выразить «осталось мало мест» (signal) и «проверенный инструктор»
 * (metal). Поведения у метки нет, поэтому брать чужую разметку ради вида смысла
 * не имеет — а вот два источника правды о цветах она бы создала.
 *
 * Текста внутри компонента нет: подпись всегда приходит из i18n или из домена.
 */

import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5 whitespace-nowrap',
    'rounded-full border border-transparent',
    'text-caption font-semibold uppercase tracking-wide',
  ],
  {
    variants: {
      variant: {
        /** Нейтральная метка на карточке: направление, уровень. */
        neutral: 'bg-surface-sunken text-content-secondary',
        /** Брендовая: акцентная роль элемента. */
        accent: 'bg-accent-soft text-accent',
        /** Живое и срочное: «осталось 2 места», «идёт трансляция». */
        signal: 'bg-signal-soft text-signal',
        /** Премиальное отличие: верификация, рейтинг, «выбор редакции». */
        metal: 'bg-metal-soft text-metal',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        /**
         * Плотная метка поверх фотографии (`.cc-badge` в макете): на снимке
         * полупрозрачный фон не читается, нужна сплошная плашка.
         */
        onMedia: 'bg-surface-card text-accent shadow-sm',
      },
      size: {
        sm: 'px-2 py-0.5 text-2xs',
        md: 'px-2.5 py-1',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
);

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };
