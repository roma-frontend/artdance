/**
 * Button — первый компонент дизайн-системы и эталон подхода.
 *
 * Обратите внимание, чего здесь НЕТ:
 *  • ни одного hex-цвета, px-размера или тайминга — только токен-утилиты;
 *  • ни одной строки текста — надпись всегда приходит из i18n через children;
 *  • ни одного `href="/..."` — ссылки строятся через `routes`.
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-semibold uppercase tracking-wide',
    'rounded-full border border-transparent',
    'transition-all duration-300 ease-brand',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        accent: 'bg-accent text-content-on-accent hover:bg-accent-hover hover:-translate-y-px shadow-md',
        outline: 'border-border-default text-content-primary hover:border-accent hover:text-content-accent',
        ghost: 'border-content-accent text-content-accent hover:bg-accent hover:text-content-on-accent',
        contrast: 'bg-surface-card text-content-primary hover:-translate-y-px shadow-md',
        onCinema:
          'border-border-on-cinema text-content-on-cinema hover:bg-content-on-cinema hover:text-content-inverse',
        /**
         * Псевдоним `accent` для компонентов shadcn/ui: их `alert-dialog` и
         * `calendar` передают `variant="default"`. Отдельного вида кнопки в
         * дизайн-системе нет — брендовое действие одно.
         */
        default:
          'bg-accent text-content-on-accent hover:bg-accent-hover hover:-translate-y-px shadow-md',
        /** Разрушающее действие: удаление, отмена брони, возврат. */
        destructive: 'bg-danger text-content-on-accent hover:opacity-90 shadow-md',
      },
      size: {
        sm: 'px-4 py-2 text-2xs',
        md: 'px-7 py-3 text-xs',
        lg: 'px-10 py-4 text-sm',
        /**
         * `default` и `icon` существуют ради компонентов shadcn/ui: их
         * `calendar`, `pagination` и `dialog` вызывают `buttonVariants({ size })`
         * с этими именами. Держим их здесь, чтобы не патчить чужие файлы,
         * которые обновляются командой `shadcn add --overwrite`.
         */
        default: 'px-7 py-3 text-xs',
        icon: 'size-11 p-0',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'accent',
      size: 'md',
      block: false,
    },
  },
);

export interface ButtonProps
  extends ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  /** Отрисовать как дочерний элемент (например, `Link`) без лишней вложенности. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button';
  return (
    <Component className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
  );
}

export { buttonVariants };
