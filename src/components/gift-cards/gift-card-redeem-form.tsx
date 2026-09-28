'use client';

/**
 * GIFT CARD REDEEM FORM — ввод кода, проверка, баланс.
 */

import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { redeemGiftCard } from '@/server/actions/gift-cards';

export function GiftCardRedeemForm() {
  const t = useTranslations('footer');
  const inputId = useId();
  const [code, setCode] = useState('');

  const { execute, status, result } = useAction(redeemGiftCard);
  const pending = status === 'executing';
  const data = result.data as { ok: boolean; balance?: number; messageKey?: string } | undefined;
  const error = result.validationErrors ?? result.serverError;

  return (
    <div className="mx-auto max-w-md rounded-xl border border-border-default bg-surface-card p-6">
      <label htmlFor={inputId} className="text-body-sm font-semibold">{t('giftCardCode')}</label>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24))}
          placeholder="XXXX-XXXX-XXXX"
          maxLength={24}
          className="form-input flex-1"
          disabled={pending}
        />
        <Button variant="accent" disabled={pending || code.trim().length < 4} onClick={() => execute({ code })}>{pending ? '…' : t('redeemCta')}</Button>
      </div>
      {error && <p role="alert" className="text-body-sm mt-3 text-content-signal">{String(error)}</p>}
      {data?.ok && <p role="status" className="text-body-sm mt-3 text-content-success">{t('redeemSuccess', { balance: data.balance ?? 0 })}</p>}
      {data && !data.ok && <p role="alert" className="text-body-sm mt-3 text-content-signal">{data.messageKey ? t(data.messageKey as never) : t('redeemNotFound')}</p>}
    </div>
  );
}
