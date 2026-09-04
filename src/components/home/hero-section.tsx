/**
 * HERO — первый экран лендинга.
 *
 * Собран из трёх независимых частей, и это разделение принципиально:
 *
 *   • `HeroParallax` — клиентская обёртка, которая раздаёт роли по
 *     `data-parallax` и двигает их при прокрутке. Секция ничего не знает о
 *     скролле;
 *   • `HeroVideo` — фоновая петля со шлейфом копий и постером;
 *   • сама секция — только разметка и текст, серверный компонент.
 *
 * Плоскость всегда кинематографичная (`cinema-surface`) — в обеих темах. Это
 * роль поверхности, а не тёмная тема: переключатель темы её не касается.
 *
 * `min-h-dvh`, а не `100vh` из макета: на iOS адресная строка меняет `vh` на
 * ходу, и первый экран дёргается при первой же прокрутке.
 *
 * Первый экран включает и поисковую строку — она приходит через `children` и
 * ставится последней, под содержимым (`.hero-viewport` в `globals.css`). В
 * прототипе она стоит на шве двух секций, и это давало сразу два дефекта: при
 * высоте hero в экран строка была видна наполовину, а в тёмной теме под ней
 * оставалась полоса фона страницы, читаемая как пустой чёрный брусок. Внутри
 * первого экрана шва нет: кадр и затемнение продолжаются под строкой до кромки.
 */

import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { HeroVideo } from '@/components/home/hero-video';
import { Counter } from '@/components/fx/counter';
import { HeroParallax } from '@/components/fx/hero-parallax';
import { Button } from '@/components/ui/button';
import { routes } from '@/config';
import type { HomeContent } from '@/domain/content';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  hero: HomeContent['hero'];
  locale: Locale;
  /** Поисковая строка первого экрана. Ставится под содержимым, у нижней кромки. */
  children?: ReactNode;
  className?: string;
}

export async function HeroSection({ hero, locale, children, className }: HeroSectionProps) {
  const t = await getTranslations('home.hero');

  return (
    <HeroParallax className={cn('flex flex-col', className)}>
      <section className="hero-viewport cinema-surface relative overflow-hidden">
        <HeroVideo video={hero.video} poster={hero.image} locale={locale} />

        {/*
          Затемнение растворяется по мере ухода экрана вверх: под ним уже нет
          текста, который нужно было бы держать читаемым.
        */}
        <div
          aria-hidden
          data-parallax="overlay"
          className="absolute inset-0 z-[1]"
          style={{ background: 'var(--scrim-hero-diagonal)' }}
        />

        {/*
          Содержимое занимает остаток экрана и центрируется в нём: верхний отступ
          отведён под фиксированную шапку, нижний — воздух до поисковой строки.
        */}
        <div
          data-parallax="content"
          className="page-container relative z-10 flex flex-1 flex-col items-start justify-center pt-24 pb-8 md:pt-28"
        >
          <p className="text-eyebrow text-metal mb-6 inline-flex items-center gap-2 rounded-full border border-metal-soft px-4 py-1.5 md:mb-8">
            {t('badge')}
          </p>

          <h1 className="text-display-hero mb-4 max-w-3xl text-content-on-cinema md:mb-6">
            {t('titleLine1')}
            <br />
            {/*
              Акцентный курсив — отдельный ключ перевода, а не HTML внутри
              строки: переводчик не должен редактировать разметку, а в армянском
              выделяется другое слово.
            */}
            <em className="text-accent-on-cinema italic">{t('titleAccent')}</em>
          </h1>

          <p className="text-body md:text-body-lg mb-8 max-w-lg text-content-on-cinema-muted md:mb-10">
            {t('subtitle')}
          </p>

          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg" variant="accent">
              <Link href={routes.discover()}>{t('primaryCta')}</Link>
            </Button>
            <Button asChild size="lg" variant="onCinema">
              <Link href={routes.instructors()}>{t('secondaryCta')}</Link>
            </Button>
          </div>

          {/*
            Показатели — список определений, а не набор div-ов: «12K+» само по
            себе ничего не значит, значение имеет пара «число — подпись», и
            скринридер читает её именно парой.

            Отступы и просветы на телефоне тесте́е: первый экран обязан вместить
            и показатели, и поисковую строку, а не отдавать её за кромку окна.
          */}
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-border-on-cinema pt-5 md:mt-10 md:gap-12 md:pt-6">
            {hero.stats.map((stat) => (
              <div key={stat.id}>
                <dd className="text-heading-4 md:text-heading-3 text-content-on-cinema">
                  <Counter
                    value={stat.value}
                    decimals={stat.decimals}
                    suffix={stat.suffix}
                    className="text-metal"
                  />
                </dd>
                <dt className="text-eyebrow mt-1 text-content-on-cinema-muted">
                  {t(
                    `stat${stat.id.charAt(0).toUpperCase()}${stat.id.slice(1)}` as 'statActiveDancers',
                  )}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        {/*
          Поисковая строка — последняя в первом экране, поверх кадра. `z-20`, а
          не `z-10`: она интерактивна и обязана лежать выше затемнения и
          содержимого, которое при прокрутке уезжает.
        */}
        {children !== undefined && <div className="relative z-20 w-full">{children}</div>}
      </section>
    </HeroParallax>
  );
}
