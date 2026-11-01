'use client';

/**
 * Форма профиля атлета: программы (Standard / Latine), клуб и разряд.
 * WDSF-номер здесь не редактируется: его подтверждает администратор.
 */

import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useState, type FormEvent } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { danceSportPrograms, danceSportProgramLabelKey, type DanceSportProgram } from '@/domain/enums';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { updateAthleteProfileAction } from '@/server/actions/athlete';

interface AthleteProfileFormProps {
  initial: { programs: readonly DanceSportProgram[]; clubName: string | null; rank: string | null };
}

export function AthleteProfileForm({ initial }: AthleteProfileFormProps) {
  const t = useTranslations('athlete.cabinet');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const [programs, setPrograms] = useState<readonly DanceSportProgram[]>(initial.programs);
  const [clubName, setClubName] = useState(initial.clubName ?? '');
  const [rank, setRank] = useState(initial.rank ?? '');

  const { execute, status, result } = useAction(updateAthleteProfileAction, {
    onSuccess: () => router.refresh(),
  });
  const busy = status === 'executing';

  function toggle(program: DanceSportProgram) {
    setPrograms((current) =>
      current.includes(program) ? current.filter((item) => item !== program) : [...current, program],
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    execute({ programs: [...programs], clubName, rank });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label text-content-secondary">{t('programs')}</legend>
        {danceSportPrograms.map((program) => (
          <label key={program} className="text-body-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={programs.includes(program)}
              onChange={() => toggle(program)}
              className="size-4"
            />
            {tRoot(danceSportProgramLabelKey(program))}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="athlete-club">{t('club')}</Label>
        <Input id="athlete-club" value={clubName} onChange={(e) => setClubName(e.target.value)} maxLength={120} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="athlete-rank">{t('rank')}</Label>
        <Input id="athlete-rank" value={rank} onChange={(e) => setRank(e.target.value)} maxLength={60} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>{t('save')}</Button>
        {result.data ? <p className="text-caption text-content-secondary">{t('saved')}</p> : null}
        <ActionError error={result.serverError} t={tRoot} />
      </div>
    </form>
  );
}
