'use client';

/**
 * REVIEW CREATE FORM — рейтинг + тело отзыва.
 */

import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { createReviewAction } from '@/server/actions/reviews';

export function ReviewCreateForm({ bookingId, token }: { bookingId: string; token?: string }) {
  const t = useTranslations('reviews');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const { execute, status, result } = useAction(createReviewAction);
  const pending = status === 'executing';
  const data = result.data as { ok: boolean } | undefined;

  if (data?.ok) {
    return <p role="status" className="rounded-md border border-border-default bg-surface-card p-4 text-content-success">{t('pendingNotice')}</p>;
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-5">
      <label className="text-body-sm font-semibold">{t('ratingLabel')}</label>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`Оценка ${n}`} className={`size-10 rounded-md border text-lg ${rating >= n ? 'border-accent bg-accent text-content-on-accent' : 'border-border-default bg-surface-sunken'}`}>★</button>
        ))}
      </div>
      <label className="text-body-sm mt-4 block font-semibold" htmlFor="review-body">{t('textLabel')}</label>
      <textarea id="review-body" value={body} onChange={(e) => setBody(e.target.value.slice(0, 2000))} maxLength={2000} rows={5} className="form-input mt-2" placeholder={t('textPlaceholder')} disabled={pending} />
      <div className="mt-4 flex items-center gap-3">
        <Button variant="accent" disabled={pending || body.trim().length < 10} onClick={() => execute({ bookingId, rating, body, ...(token ? { token } : {}) })}>{pending ? '…' : t('submit')}</Button>
        {(result.validationErrors || result.serverError) && <span role="alert" className="text-body-sm text-content-signal">{String(result.validationErrors ?? result.serverError)}</span>}
      </div>
    </div>
  );
}
