'use client';

/**
 * REVIEW REPLY PANEL — ответ исполнителя на отзыв в кабинете студии.
 *
 * На отзыв один ответ: сохранение создаёт или заменяет его, удаление убирает.
 * Права (инструктор отзыва, участник площадки или администратор) проверяет
 * сервис ответов; панель только отправляет запрос и показывает результат.
 */

import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { replyLengths } from '@/domain/review-reply';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { deleteReviewReplyAction, replyToReviewAction } from '@/server/actions/reviews';

interface ReviewReplyPanelProps {
  reviewId: string;
  existingReply: string | null;
}

export function ReviewReplyPanel({ reviewId, existingReply }: ReviewReplyPanelProps) {
  const t = useTranslations('reviews');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const [body, setBody] = useState(existingReply ?? '');

  const save = useAction(replyToReviewAction, { onSuccess: () => router.refresh() });
  const remove = useAction(deleteReviewReplyAction, {
    onSuccess: () => {
      setBody('');
      router.refresh();
    },
  });

  const pending = save.status === 'executing' || remove.status === 'executing';
  const valid = body.trim().length >= replyLengths.min;
  const error = save.result.serverError ?? remove.result.serverError;

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
      <label htmlFor={`reply-${reviewId}`} className="text-body-sm font-semibold">
        {t('replyLabel')}
      </label>
      <textarea
        id={`reply-${reviewId}`}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, replyLengths.max))}
        maxLength={replyLengths.max}
        rows={3}
        className="form-input"
        placeholder={t('replyPlaceholder')}
        disabled={pending}
      />
      <p className="text-caption text-content-tertiary">{t('replyHint', { min: replyLengths.min })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={pending || !valid}
          onClick={() => save.execute({ reviewId, body })}
        >
          {existingReply ? t('replyUpdate') : t('replySubmit')}
        </Button>
        {existingReply ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => remove.execute({ reviewId })}
          >
            {t('replyDelete')}
          </Button>
        ) : null}
      </div>
      {save.result.data?.ok ? (
        <p role="status" className="text-body-sm text-content-success">{t('replySaved')}</p>
      ) : null}
      {remove.result.data?.ok ? (
        <p role="status" className="text-body-sm text-content-success">{t('replyDeleted')}</p>
      ) : null}
      <ActionError error={error} t={tRoot} />
    </div>
  );
}
