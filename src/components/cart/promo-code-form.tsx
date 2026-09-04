/**
 * PROMO CODE FORM — ввод промокода.
 *
 * **Этого блока в прототипе нет**, и это дыра, а не решение: в макете скидка
 * показана уже применённой строкой «Discount (WELCOME10) −6 050 ֏», то есть код
 * взялся из ниоткуда. Ключи для формы в каталоге переводов при этом есть
 * (`cart.promoPlaceholder`, `promoApply`, `promoApplied`, `promoInvalid`), и
 * состояния `promo-applied` / `promo-invalid` перечислены в карте компонентов —
 * поле ввода ожидается продуктом.
 *
 * **Код не проверяется здесь.** Существует ли он, не истёк ли, не исчерпан ли
 * лимит, стакается ли с подпиской — вопросы к БД и к `promotions`, и решаются в
 * server action. Компонент проверяет только длину (`promotions.codeMinLength`),
 * чтобы не отправлять запрос на два символа, и приводит ввод к верхнему
 * регистру: коды регистронезависимы, а «welcome10» в поле выглядит как опечатка.
 *
 * **Применённый код показывается с возможностью снять.** Иначе единственный
 * способ отказаться от скидки — очистить корзину; в заказе допустим один код
 * (`promotions.maxCodesPerOrder`), поэтому заменить его можно только через отмену.
 */

'use client';

import { CheckIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { promotions } from '@/config';
import { cn } from '@/lib/utils';

interface PromoCodeFormProps {
  /** Уже применённый код. Тогда вместо поля показывается результат. */
  appliedCode?: string | null;
  onApply(code: string): void;
  onRemove?(): void;
  /** Код не подошёл: сервер ответил отказом. */
  invalid?: boolean;
  pending?: boolean;
  className?: string;
}

export function PromoCodeForm({
  appliedCode,
  onApply,
  onRemove,
  invalid = false,
  pending = false,
  className,
}: PromoCodeFormProps) {
  const t = useTranslations('cart');
  const tCommon = useTranslations('common');
  const [code, setCode] = useState('');

  const trimmed = code.trim();
  const tooShort = trimmed.length < promotions.codeMinLength;

  if (appliedCode) {
    return (
      <p
        className={cn(
          'text-caption flex items-center gap-2 rounded-md bg-success-soft px-3 py-2',
          'font-semibold text-content-success',
          className,
        )}
      >
        <CheckIcon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">{t('promoApplied', { code: appliedCode })}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            aria-label={`${tCommon('actions.remove')} — ${appliedCode}`}
            className="shrink-0 transition-opacity duration-normal ease-brand hover:opacity-70 disabled:opacity-50"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        )}
      </p>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (tooShort || pending) return;
    onApply(trimmed);
  };

  return (
    <form onSubmit={submit} className={className}>
      <FormField
        name="promoCode"
        labelKey="cart.promoPlaceholder"
        labelHidden
        errorKey={invalid ? 'cart.promoInvalid' : null}
      >
        {(field) => (
          <div className="flex gap-2">
            <input
              id={field.id}
              name={field.name}
              type="text"
              inputMode="text"
              autoComplete="off"
              /* Коды регистронезависимы, поэтому ввод сразу нормализуется. */
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={promotions.codeMaxLength}
              placeholder={t('promoPlaceholder')}
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid}
              className="form-input uppercase"
            />
            <Button type="submit" variant="outline" size="md" disabled={tooShort || pending}>
              {t('promoApply')}
            </Button>
          </div>
        )}
      </FormField>
    </form>
  );
}
