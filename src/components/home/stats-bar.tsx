'use client';

import { useTranslations } from 'next-intl';

import { Counter } from '@/components/fx/counter';
import { Reveal } from '@/components/fx/reveal';
import type { HomeContent } from '@/domain/content';

interface StatsBarProps {
  stats: HomeContent['hero']['stats'];
}

export function StatsBar({ stats }: StatsBarProps) {
  const t = useTranslations('home.hero');

  return (
    <section className="border-y border-border-default/60 bg-surface-card/60 backdrop-blur-md">
      <div className="page-container py-8 md:py-10">
        <Reveal variant="scale">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-12">
            {stats.map((stat) => (
              <div key={stat.id} className="flex flex-col items-center text-center">
                <dd className="text-heading-3 md:text-heading-2 text-content-primary">
                  <Counter
                    value={stat.value}
                    decimals={stat.decimals}
                    suffix={stat.suffix}
                    className="text-metal"
                  />
                </dd>
                <dt className="text-eyebrow mt-1 text-content-secondary">
                  {t(
                    `stat${stat.id.charAt(0).toUpperCase()}${stat.id.slice(1)}` as 'statActiveDancers',
                  )}
                </dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
