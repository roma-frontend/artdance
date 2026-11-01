'use client';

/**
 * Форма записи места атлета в админке. Список регистраций приходит с сервера: только
 * утверждённые регистрации на прошедшие соревнования, у которых места ещё нет.
 */

import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useState, type FormEvent } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { competitionPlaces, type CompetitionPlace } from '@/domain/athlete-rating';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { recordCompetitionResultAction } from '@/server/actions/admin/competitions';

interface CompetitionResultFormProps {
  registrations: readonly { id: string; eventTitle: string; categoryName: string; athleteName: string }[];
}

export function CompetitionResultForm({ registrations }: CompetitionResultFormProps) {
  const t = useTranslations('competitionResults.admin');
  const tPlace = useTranslations('competitionPlace');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const [registrationId, setRegistrationId] = useState(registrations[0]?.id ?? '');
  const [place, setPlace] = useState<CompetitionPlace>('PARTICIPANT');

  const { execute, status, result } = useAction(recordCompetitionResultAction, {
    onSuccess: () => router.refresh(),
  });
  const busy = status === 'executing';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    execute({ registrationId, place });
  }

  if (registrations.length === 0) {
    return <p className="text-body-sm text-content-secondary">{t('nothingToRecord')}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h2 className="text-card-title">{t('recordTitle')}</h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="competition-result-registration">{t('registration')}</Label>
        <select
          id="competition-result-registration"
          value={registrationId}
          onChange={(e) => setRegistrationId(e.target.value)}
          className="h-10 rounded-md border border-border-default bg-surface-card px-3 text-body-sm"
        >
          {registrations.map((row) => (
            <option key={row.id} value={row.id}>
              {`${row.athleteName} · ${row.eventTitle} · ${row.categoryName}`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="competition-result-place">{t('place')}</Label>
        <select
          id="competition-result-place"
          value={place}
          onChange={(e) => setPlace(e.target.value as CompetitionPlace)}
          className="h-10 rounded-md border border-border-default bg-surface-card px-3 text-body-sm"
        >
          {competitionPlaces.map((item) => (
            <option key={item} value={item}>{tPlace(item)}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>{t('record')}</Button>
        {result.data ? <p className="text-caption text-content-secondary">{t('saved')}</p> : null}
        <ActionError error={result.serverError} t={tRoot} />
      </div>
    </form>
  );
}
