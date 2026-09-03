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
 */

import { getFormatter, getTranslations } from 'next-intl/server';

import { HeroVideo } from '@/components/home/hero-video';
import { HeroParallax } from '@/components/fx/hero-parallax';
import { Button } from '@/components/ui/button';
import { routes } from '@/config';
import type { HomeContent } from '@/domain/content';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';

interface HeroSectionProps {
  hero: HomeContent['hero'];
  locale: Locale;
}

export async function HeroSection({ hero, locale }: HeroSectionProps) {
  const t = await getTranslations('home.hero');
  const format = await getFormatter();

  return (
    <HeroParallax>
      <section className="cinema-surface relative flex min-h-dvh items-center overflow-hidden">
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

        <div data-parallax="content" className="page-container relative z-10 pt-32 pb-20">
          <p className="text-eyebrow text-metal mb-8 inline-flex items-center gap-2 rounded-full border border-metal-soft px-4 py-1.5">
            {t('badge')}
          </p>

          <h1 className="text-display-hero mb-6 max-w-3xl text-content-on-cinema">
            {t('titleLine1')}
            <br />
            {/*
              Акцентный курсив — отдельный ключ перевода, а не HTML внутри
              строки: переводчик не должен редактировать разметку, а в армянском
              выделяется другое слово.
            */}
            <em className="text-accent-on-cinema italic">{t('titleAccent')}</em>
          </h1>

          <p className="text-body-lg mb-10 max-w-lg text-content-on-cinema-muted">{t('subtitle')}</p>

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
          */}
          <dl className="mt-16 flex flex-wrap gap-12 border-t border-border-on-cinema pt-6">
            {hero.stats.map((stat) => (
              <div key={stat.id}>
                <dd className="text-heading-3 text-content-on-cinema">
                  <span className="text-metal">
                    {stat.decimals > 0
                      ? format.number(stat.value, 'rating')
                      : format.number(stat.value, 'plain')}
                  </span>
                  {stat.suffix}
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
      </section>
    </HeroParallax>
  );
}
