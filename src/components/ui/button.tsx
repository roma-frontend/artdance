/**
 * Button — первый компонент дизайн-системы и эталон подхода.
 *
 * Обратите внимание, чего здесь НЕТ:
 *  • ни одного hex-цвета, px-размера или тайминга — только токен-утилиты;
 *  • ни одной строки текста — надпись всегда приходит из i18n через children;
 *  • ни одного `href="/..."` — ссылки строятся через `routes`.
 */

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
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
        outline: 'border-border-default text-content-primary hover:border-accent hover:text-accent',
        ghost: 'border-accent text-accent hover:bg-accent hover:text-content-on-accent',
        contrast: 'bg-surface-card text-content-primary hover:-translate-y-px shadow-md',
        onCinema:
          'border-border-on-cinema text-content-on-cinema hover:bg-content-on-cinema hover:text-content-inverse',
      },
      size: {
        sm: 'px-4 py-2 text-2xs',
        md: 'px-7 py-3 text-xs',
        lg: 'px-10 py-4 text-sm',
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
  const Component = asChild ? Slot : 'button';
  return (
    <Component className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
  );
}

export { buttonVariants };
