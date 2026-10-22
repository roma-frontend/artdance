'use client';

/**
 * АНКЕТА ТАНЦОРА — блок «О танцоре».
 *
 * Один компонент на все места, где инструктор смотрит клиента: админка,
 * карточка брони, чек-ин на кассе. Три копии разъедутся на первом же переводе,
 * а «с чего начать» должно читаться одинаково всюду.
 *
 * **Клиентский компонент, а не серверный.** Одни и те же данные показываются
 * и в серверном экране, и в сканере чек-ина, который получает их по API. Если
 * компонент был бы серверным, чек-ину пришлось бы готовить подписи на API и
 * передавать готовые строки — иначе второй экран показал бы уровень записью
 * `BEGINNER`.
 *
 * **Пустая анкета не показывается вовсе.** Блок «уровень не указан» — это шум:
 * отсутствие анкеты и отсутствие данных внутри неё — разные вещи, и второе
 * честнее сказать одной строкой.
 */

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import {
  danceStyleLabelKey,
  dancerLevelLabelKey,
  danceStyles,
  isDancerLevel,
  type DanceStyle,
} from '@/domain/enums';
import { cn } from '@/lib/utils';

export interface DancerProfileView {
  level: string;
  styles: string[];
  goal: string | null;
  note: string | null;
}

/** Известные направления: база может вернуть что угодно после смены enum. */
function knownStyles(styles: readonly string[]): DanceStyle[] {
  const set = new Set<string>(danceStyles);
  return styles.filter((style): style is DanceStyle => set.has(style));
}

export function DancerProfileCard({
  profile,
  className,
}: {
  profile: DancerProfileView | null | undefined;
  className?: string;
}) {
  const t = useTranslations('dancerProfile');
  const tRoot = useTranslations();

  if (!profile) return null;

  const level = isDancerLevel(profile.level) ? profile.level : null;
  const styles = knownStyles(profile.styles);
  const goal = profile.goal?.trim() || null;
  const note = profile.note?.trim() || null;

  if (!level && styles.length === 0 && !goal && !note) return null;

  return (
    <section
      aria-labelledby="dancer-profile-title"
      className={cn(
        'rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm sm:p-6',
        className,
      )}
    >
      <h2 id="dancer-profile-title" className="text-card-title text-content-primary">
        {t('title')}
      </h2>

      <dl className="mt-4 flex flex-col gap-2">
        {level ? (
          <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2">
            <dt className="text-caption uppercase text-content-tertiary">{t('level')}</dt>
            <dd className="text-body-sm text-content-primary">
              <Badge variant="accent" size="sm">
                {tRoot(dancerLevelLabelKey(level))}
              </Badge>
            </dd>
          </div>
        ) : null}

        {styles.length > 0 ? (
          <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2">
            <dt className="text-caption uppercase text-content-tertiary">{t('styles')}</dt>
            <dd className="flex flex-wrap justify-end gap-1.5">
              {styles.map((style) => (
                <Badge key={style} variant="neutral" size="sm">
                  {tRoot(danceStyleLabelKey(style))}
                </Badge>
              ))}
            </dd>
          </div>
        ) : null}

        {goal ? (
          <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2">
            <dt className="text-caption uppercase text-content-tertiary">{t('goal')}</dt>
            <dd className="text-body-sm max-w-[60%] text-end text-content-primary">{goal}</dd>
          </div>
        ) : null}

        {note ? (
          <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2">
            <dt className="text-caption uppercase text-content-tertiary">{t('note')}</dt>
            <dd className="text-body-sm max-w-[60%] text-end text-content-primary">{note}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
