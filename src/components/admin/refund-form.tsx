'use client';

/**
 * REFUND FORM — ручной возврат по заказу.
 *
 * Три вещи, которые обязаны быть видны администратору до нажатия:
 *  • сколько вообще можно вернуть (оплачено минус уже возвращённое) — считает
 *    сервер и передаёт сюда; поле не даёт ввести больше;
 *  • что возврат выше порога уйдёт на согласование второму администратору, а не
 *    выполнится сразу;
 *  • что деньги возвращает провайдер: запись создаётся в состоянии «ожидает», и
 *    показывать «возвращено» до подтверждения банка нельзя.
 *
 * Причина обязательна: без неё возврат невозможно объяснить ни клиенту, ни
 * бухгалтерии.
 */

import { useAction } from 'next-safe-action/hooks';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { security } from '@/config/business';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { refundOrder } from '@/server/actions/admin/operations';

interface RefundFormProps {
  orderId: string;
  /** Предел возврата в драмах, посчитанный на сервере. */
  refundable: number;
}

export function RefundForm({ orderId, refundable }: RefundFormProps) {
  const t = useTranslations('admin.orders');
  const tRoot = useTranslations() as unknown as Translate;
  const format = useFormatter();
  const router = useRouter();

  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState('');

  const { execute, status, result } = useAction(refundOrder, {
    onSuccess: () => {
      setAmount('');
      setReason('');
      router.refresh();
    },
  });

  const busy = status === 'executing';
  const parsed = Number.parseInt(amount, 10);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= refundable && reason.trim().length >= 3;

  if (refundable <= 0) {
    return <p className="text-body-sm text-content-tertiary">{t('refundNoPayment')}</p>;
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) execute({ id: orderId, amount: parsed, reason });
      }}
    >
      <p className="text-body-sm text-content-secondary">
        {t('refundLimit', { max: format.number(security.guardrails.maxManualRefund, 'price') })}
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="refund-amount" className="text-label uppercase text-content-secondary">
          {t('refundAmountLabel')}
        </label>
        <input
          id="refund-amount"
          type="number"
          inputMode="numeric"
          min={1}
          max={refundable}
          step={1}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="form-input"
        />
        <p className="text-caption text-content-tertiary">{format.number(refundable, 'price')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="refund-reason" className="text-label uppercase text-content-secondary">
          {t('refundReasonLabel')}
        </label>
        <textarea
          id="refund-reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="form-input resize-y"
        />
      </div>

      <ActionError error={result.serverError} t={tRoot} />

      {result.data?.requiresApproval === true ? (
        <p role="status" className="text-body-sm font-semibold text-content-warning">
          {tRoot('admin.errors.approvalRequired')}
        </p>
      ) : null}

      {result.data?.registered === true ? (
        <p role="status" className="text-body-sm font-semibold text-content-success">
          {t('refunded')}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="sm" disabled={busy || !valid}>
        {t('refundCta')}
      </Button>
    </form>
  );
}
