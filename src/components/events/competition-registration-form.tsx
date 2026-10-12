'use client';

import { useActionState } from 'react';

import { submitCompetitionRegistration, type CompetitionRegistrationState } from '@/server/actions/competitions';
import type { CompetitionCategoryItem } from '@/domain/content';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

const initialState: CompetitionRegistrationState = { status: 'idle' };

export function CompetitionRegistrationForm({
  eventSlug,
  categories,
}: {
  eventSlug: string;
  categories: readonly CompetitionCategoryItem[];
}) {
  const t = useTranslations('events');
  const [state, action, pending] = useActionState(submitCompetitionRegistration, initialState);

  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="eventSlug" value={eventSlug} />

      <label className="block text-body-sm">
        <span className="mb-1.5 block font-semibold">{t('competitionCategories')}</span>
        <select
          name="categoryId"
          required
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-card px-3"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id} disabled={category.spotsLeft === 0}>
              {category.name} · {category.ageGroup}
              {category.spotsLeft !== undefined ? ` · ${category.spotsLeft}` : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-body-sm">
        <span className="mb-1.5 block font-semibold">{t('athleteBirthDate')}</span>
        <input
          type="date"
          name="birthDate"
          required
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-card px-3"
        />
      </label>

      <label className="block text-body-sm">
        <span className="mb-1.5 block font-semibold">{t('partnerName')}</span>
        <input
          type="text"
          name="partnerName"
          maxLength={160}
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-card px-3"
        />
      </label>

      {state.status !== 'idle' && state.messageKey && (
        <p role={state.status === 'error' ? 'alert' : 'status'} className="text-body-sm text-content-secondary">
          {state.messageKey.startsWith('events.')
            ? t(state.messageKey.replace('events.', '') as never)
            : t('registrationError')}
        </p>
      )}

      <Button type="submit" block variant="accent" disabled={pending}>
        {t('submitRegistration')}
      </Button>
    </form>
  );
}
