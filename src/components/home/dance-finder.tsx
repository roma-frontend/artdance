'use client';

import { ArrowRightIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { danceFinderLevels, danceIntents, routes, suggestedDanceStyles, type DanceIntent } from '@/config';
import { danceStyleLabelKey, skillLevelLabelKey } from '@/domain/enums';
import { getPathname, Link } from '@/i18n/routing';
import { useRouter } from '@/i18n/routing';

const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

interface FinderStyle { style: string; classCount: number }

/** The result is a shareable catalog URL, not a simulated booking or an AI diagnosis. */
export function DanceFinder({ styles }: { styles: readonly FinderStyle[] }) {
  const t = useTranslations('home.finder');
  const root = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
  const id = useId();
  const [intent, setIntent] = useState<DanceIntent>('energy');
  const available = styles.filter((item) => item.classCount > 0).map((item) => item.style);
  const suggested = suggestedDanceStyles(intent, available);

  return (
    <form
      data-slot="dance-finder"
      data-hydrated={hydrated}
      action={getPathname({ locale, href: routes.discover() })}
      method="get"
      className="dance-finder mt-10 rounded-2xl border border-border-default bg-surface-card p-6 sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const style = String(data.get('style') || '');
        const level = String(data.get('level') || '');
        const date = String(data.get('date') || '');
        router.push(routes.discover({ scope: 'classes', style, level: level === 'ALL_LEVELS' ? undefined : level, date }));
      }}
    >
      <input type="hidden" name="scope" value="classes" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-heading-3">{t('title')}</h3>
          <p className="text-body-sm mt-2 max-w-2xl text-content-secondary">{t('subtitle')}</p>
        </div>
        <span className="text-eyebrow text-content-secondary">{t('badge')}</span>
      </div>
      <fieldset className="mt-6">
        <legend className="text-label font-semibold text-content-primary">{t('intentLabel')}</legend>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {danceIntents.map((value) => (
            <label key={value} className="dance-intent relative cursor-pointer rounded-xl border border-border-default p-4">
              <input type="radio" name="intent" value={value} checked={intent === value} onChange={() => setIntent(value)} className="sr-only" />
              <span className="text-body-sm block font-semibold">{t(`intents.${value}.title`)}</span>
              <span className="text-caption mt-1 block text-content-secondary">{t(`intents.${value}.body`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-label block font-semibold" htmlFor={`${id}-style`}>{t('styleLabel')}</label>
          {/* Remount only this select: a change of intent resets the recommendation, not the other answers. */}
          <select key={intent} id={`${id}-style`} name="style" className="dance-finder-select mt-2" defaultValue={suggested[0] || ''}>
            {suggested.length ? suggested.map((style) => <option key={style} value={style}>{root(danceStyleLabelKey(style))}</option>) : <option value="">{t('allStyles')}</option>}
          </select>
        </div>
        <div>
          <label className="text-label block font-semibold" htmlFor={`${id}-level`}>{t('levelLabel')}</label>
          <select id={`${id}-level`} name="level" defaultValue="BEGINNER" className="dance-finder-select mt-2">
            {danceFinderLevels.map((level) => <option value={level} key={level}>{root(skillLevelLabelKey(level))}</option>)}
          </select>
        </div>
        <div>
          <label className="text-label block font-semibold" htmlFor={`${id}-date`}>{t('dateLabel')}</label>
          <Input id={`${id}-date`} type="date" name="date" className="mt-2 h-11" />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p role="status" className="text-caption max-w-xl text-content-secondary">{suggested.length ? t('hint') : t('empty')}</p>
        <Button type="submit">{t('cta')}<ArrowRightIcon className="size-4" aria-hidden /></Button>
      </div>
      <noscript><p className="text-body-sm mt-4"><Link href={routes.discover({ scope: 'classes' })} className="underline">{t('allClasses')}</Link></p></noscript>
    </form>
  );
}
