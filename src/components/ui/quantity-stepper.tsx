/**
 * QUANTITY STEPPER — количество товара в позиции корзины.
 *
 * В прототипе это три `<div>` с рамкой и символами «−» и «+» без обработчиков.
 * Здесь — две настоящие кнопки с доступными именами (`a11y.quantityIncrease` /
 * `quantityDecrease`) и число между ними. Значков-символов в разметке нет:
 * «−» из шрифта в дереве доступности читается как «минус», а иконка `lucide`
 * помечена `aria-hidden`, и скринридер получает только осмысленное имя кнопки.
 *
 * **Границы приходят из домена, а не из разметки.** Верхний предел —
 * `commerce.maxQuantityPerItem` через `clampQuantity`: то же правило действует
 * на сервере при пересчёте корзины, и второй его копии в компоненте быть не
 * должно. Кнопка на границе отключается, а не молча ничего не делает — иначе
 * пользователь жмёт «+» и решает, что интерфейс сломан.
 *
 * **Значение управляется снаружи.** Компонент не хранит количество: истина о
 * корзине живёт на сервере (после `validateCart` она может измениться), и
 * локальное состояние здесь означало бы расхождение с итогом заказа.
 *
 * Число выводится форматтером локали, а не как есть: в армянской и русской
 * локали разделитель разрядов разный, а количество может быть двузначным.
 */

'use client';

import { MinusIcon, PlusIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { commerce } from '@/config';
import { clampQuantity } from '@/domain/cart';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  value: number;
  onChange(next: number): void;
  /** Ниже минимума кнопка «−» отключается. Удаление — отдельное действие. */
  min?: number;
  max?: number;
  /** Позиция недоступна или запрос ещё выполняется. */
  disabled?: boolean;
  /** Доступное имя группы: «Количество — Premium Dance Bag». */
  label?: string;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = commerce.maxQuantityPerItem,
  disabled = false,
  label,
  className,
}: QuantityStepperProps) {
  const t = useTranslations('a11y');
  const format = useFormatter();

  const current = clampQuantity(value);
  const atMin = current <= min;
  const atMax = current >= max;

  const step = (delta: number) => {
    const next = clampQuantity(current + delta);
    if (next !== current) onChange(next);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center overflow-hidden rounded-md border border-border-default',
        disabled && 'opacity-50',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || atMin}
        aria-label={t('quantityDecrease')}
        className={cn(
          'flex size-8 items-center justify-center text-content-primary',
          'transition-colors duration-normal ease-brand',
          'hover:bg-interactive-hover disabled:pointer-events-none disabled:text-content-disabled',
        )}
      >
        <MinusIcon className="size-4" aria-hidden />
      </button>

      {/*
        `aria-live` здесь не нужен: изменение количества озвучивает сама кнопка
        через смену доступного значения соседнего элемента, а объявление на
        каждое нажатие превратилось бы в поток «два, три, четыре».
      */}
      <span className="text-body-sm w-8 text-center font-semibold tabular-nums">
        {format.number(current, 'plain')}
      </span>

      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled || atMax}
        aria-label={t('quantityIncrease')}
        className={cn(
          'flex size-8 items-center justify-center text-content-primary',
          'transition-colors duration-normal ease-brand',
          'hover:bg-interactive-hover disabled:pointer-events-none disabled:text-content-disabled',
        )}
      >
        <PlusIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
