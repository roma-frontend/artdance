/**
 * LOCATION OPTION PICKER — где проходит занятие.
 *
 * Три варианта из макета: студия, адрес клиента (с платой за выезд), онлайн.
 *
 * **Опция, которой не будет, не показывается серой.** Инструктор, который не
 * выезжает, — это не «недоступный выбор», а отсутствующий: `acceptsTravel` и
 * `acceptsOnline` убирают вариант из списка. Отключённая опция без объяснения
 * заставляет человека искать причину, которой нет в интерфейсе.
 *
 * **Плата за выезд — из `booking.travelFee`** и форматируется как деньги, а не
 * подставляется в строку перевода готовой суммой: «+5,000 AMD» вместо «+5 000 ֏»
 * — признак непереведённого сайта, а radius в 15 км (`travelRadiusKm`) проверяет
 * адресный шаг, а не этот компонент.
 *
 * **`RadioGroup` из Radix, а не нативные radio, как в прототипе.** Нативные дают
 * правильную семантику, но их вид не поддаётся стилизации согласованно между
 * браузерами, а карточка-вариант в макете — это не кружок с подписью. Radix
 * оставляет модель радиогруппы целиком: стрелки перемещают выбор, в табуляцию
 * попадает одна точка входа, `aria-checked` на месте.
 */

'use client';

import { MonitorIcon, MapPinIcon, HomeIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { booking, type BookingLocationOption } from '@/config';
import type { Money } from '@/domain/money';
import { cn } from '@/lib/utils';

interface LocationOptionPickerProps {
  value: BookingLocationOption;
  onChange(option: BookingLocationOption): void;
  /** Название студии для подписи варианта «в студии». */
  studioName?: string;
  /** Инструктор выезжает к клиенту. Иначе варианта нет в списке. */
  acceptsTravel?: boolean;
  acceptsOnline?: boolean;
  /** Плата за выезд. По умолчанию — правило платформы. */
  travelFee?: Money;
  className?: string;
}

export function LocationOptionPicker({
  value,
  onChange,
  studioName,
  acceptsTravel = true,
  acceptsOnline = true,
  travelFee = booking.travelFee,
  className,
}: LocationOptionPickerProps) {
  const t = useTranslations('booking');
  const format = useFormatter();

  const options = [
    {
      id: 'STUDIO' as const,
      icon: MapPinIcon,
      label: t('locationStudio'),
      /* Без названия студии подпись «{studio} · включено» превратилась бы в « · включено». */
      note: studioName ? t('locationStudioNote', { studio: studioName }) : undefined,
      visible: true,
    },
    {
      id: 'CUSTOMER_LOCATION' as const,
      icon: HomeIcon,
      label: t('locationCustomer'),
      note: t('locationCustomerNote', { fee: format.number(travelFee, 'price') }),
      visible: acceptsTravel,
    },
    {
      id: 'ONLINE' as const,
      icon: MonitorIcon,
      label: t('locationOnline'),
      note: t('locationOnlineNote'),
      visible: acceptsOnline,
    },
  ].filter((option) => option.visible);

  return (
    <fieldset className={cn('rounded-lg border border-border-default bg-surface-card p-6', className)}>
      <legend className="text-body-sm float-none mb-3 font-semibold">{t('locationTitle')}</legend>

      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as BookingLocationOption)}
        className="gap-2"
      >
        {options.map((option) => {
          const Icon = option.icon;
          const checked = value === option.id;

          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border p-3',
                'transition-colors duration-normal ease-brand',
                checked
                  ? 'border-accent bg-accent-soft'
                  : 'border-border-default hover:border-border-strong',
              )}
            >
              <RadioGroupItem value={option.id} />

              <Icon
                className={cn(
                  'size-4 shrink-0',
                  checked ? 'text-content-accent' : 'text-content-tertiary',
                )}
                aria-hidden
              />

              <span className="min-w-0">
                <span className="text-body-sm block font-semibold">{option.label}</span>
                {option.note && (
                  <span className="text-caption block text-content-tertiary">{option.note}</span>
                )}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
