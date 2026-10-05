/**
 * JOURNEY — «Четыре шага до паркета» как стопка наезжающих карточек
 * (`StackCards`): каждая следующая прилипает чуть ниже и накрывает предыдущую,
 * а накрытая уменьшается и темнеет.
 *
 * Карточки — обычный упорядоченный список со ссылками: порядок чтения и
 * табуляции совпадает с визуальным, и без JS или при `prefers-reduced-motion`
 * это просто четыре блока подряд.
 */

import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Reveal } from '@/components/fx/reveal';
import { StackCards } from '@/components/fx/stack-cards';
import { JourneyTrack } from '@/components/home/journey-track';
import { Media } from '@/components/ui/media';
import { SectionHeading } from '@/components/ui/section-heading';
import { firstLessonTopics, routes } from '@/config';
import { resolveMedia, type MediaRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';

const steps = [
  { key: 'style', href: routes.styles() },
  { key: 'master', href: routes.instructors() },
  { key: 'book', href: routes.booking() },
  { key: 'stage', href: routes.competitions() },
] as const;

interface JourneySectionProps {
  /** Кадр на каждый шаг, по порядку; недостающие шаги остаются без кадра. */
  images: readonly MediaRef[];
  locale: Locale;
}

export function JourneySection({ images, locale }: JourneySectionProps) {
  const t = useTranslations('home.journey');

  return (
    <section className="section-y relative">
      <div className="page-container relative">
        <JourneyTrack totalSteps={steps.length} />

        <Reveal className="mb-12">
          <SectionHeading
            eyebrow={t('eyebrow')}
            title={t('title')}
            subtitle={t('subtitle')}
            className="mb-0"
          />
        </Reveal>

        <StackCards aria-label={t('title')}>
          {steps.map((step, index) => {
            const image = images[index];
            return (
              <li key={step.key} data-journey-step="">
                <article className="grid grid-cols-1 overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-lg md:grid-cols-2 transition-colors duration-slow">
                  <div className="flex min-w-0 flex-col p-6 sm:p-8 lg:p-12">
                    <span
                      aria-hidden
                      data-journey-number=""
                      className="journey-step-number text-display-editorial transition-all duration-slow"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-heading-1 mt-6 wrap-break-word hyphens-auto">{t(`${step.key}.title`)}</h3>
                    <p className="text-body-lg mt-3 max-w-md text-content-secondary">{t(`${step.key}.body`)}</p>
                    <Link
                      href={step.href}
                      className="text-label mt-auto inline-flex items-center gap-2 pt-8 font-semibold text-content-primary underline decoration-border-default underline-offset-4 hover:text-content-accent hover:decoration-accent"
                    >
                      {t(`${step.key}.cta`)}
                      <ArrowRightIcon aria-hidden className="size-4" />
                    </Link>
                  </div>
                  {image && (
                    <div className="relative hidden md:block">
                      <Media
                        {...resolveMedia(image, locale)}
                        alt=""
                        preset="categoryCard"
                        fill
                        className="size-full"
                      />
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </StackCards>
        <aside data-slot="first-lesson" className="mt-10 rounded-2xl border border-border-default bg-surface-card p-6 sm:p-8">
          <h3 className="text-heading-3">{t('firstLesson.title')}</h3>
          <p className="text-body-sm mt-2 text-content-secondary">{t('firstLesson.subtitle')}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {firstLessonTopics.map((topic) => (
              <details key={topic} className="first-lesson-tip rounded-xl border border-border-default p-4">
                <summary className="text-body-sm cursor-pointer font-semibold">{t(`firstLesson.${topic}.question`)}</summary>
                <p className="text-body-sm mt-3 text-content-secondary">{t(`firstLesson.${topic}.answer`)}</p>
              </details>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
