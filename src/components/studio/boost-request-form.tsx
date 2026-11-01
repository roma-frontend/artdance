'use client';

/**
 * Заявка на буст из кабинета студии. Сумма и даты проверяются сервером так же, как
 * здесь: сервер решает, интерфейс только не даёт ввести заведомо неверное значение.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { requestBoost } from '@/server/actions/boost';

const MIN_BID = 1000;
const MAX_BID = 100_000;

export function BoostRequestForm() {
  const t = useTranslations('boost.studio');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const [bidAmount, setBidAmount] = useState(String(MIN_BID));
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const { execute, status, result } = useAction(requestBoost, {
    onSuccess: () => {
      setStartsAt('');
      setEndsAt('');
      router.refresh();
    },
  });

  const bid = Number(bidAmount);
  const bidValid = Number.isInteger(bid) && bid >= MIN_BID && bid <= MAX_BID && bid % 100 === 0;
  const periodValid = startsAt !== '' && endsAt !== '' && new Date(endsAt) > new Date(startsAt);
  const busy = status === 'executing';

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!bidValid || !periodValid) return;
        execute({ bidAmount: bid, startsAt: new Date(startsAt), endsAt: new Date(endsAt) });
      }}
    >
      <label className="text-body-sm flex flex-col gap-1 text-content-secondary">
        {t('bid')}
        <input
          type="number"
          min={MIN_BID}
          max={MAX_BID}
          step={100}
          value={bidAmount}
          onChange={(event) => setBidAmount(event.target.value)}
          className="form-input"
        />
        <span className="text-caption">{t('bidHint', { min: MIN_BID, max: MAX_BID })}</span>
      </label>
      <label className="text-body-sm flex flex-col gap-1 text-content-secondary">
        {t('start')}
        <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="form-input" />
      </label>
      <label className="text-body-sm flex flex-col gap-1 text-content-secondary">
        {t('end')}
        <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="form-input" />
      </label>

      <ActionError error={result.serverError} t={tRoot} />
      {result.data ? (
        <p role="status" className="text-body-sm text-content-secondary">
          {t('requested')}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={busy || !bidValid || !periodValid}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
