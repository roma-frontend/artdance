/**
 * HERO — первый экран лендинга.
 *
 * Собран из трёх независимых частей, и это разделение принципиально:
 *
 *   • `HeroParallax` — клиентская обёртка. Она задаёт полосу разгона
 *     (`.hero-stage`), считает долю раскрытия и двигает по ней содержимое и
 *     затемнение. Секция ничего не знает о прокрутке;
 *   • `HeroVideo` — кадр с занавесом, который раскрывается по той же доле;
 *   • сама секция — только разметка и текст, серверный компонент.
 *
 * Первый экран занимает две высоты окна: одну видно, вторая тратится на
 * раскрытие, пока секция приколота к верху. Иначе занавес открывался бы уже за
 * кромкой окна — экран высотой в один экран не даёт хода прокрутки, а раскрытие
 * без хода читается как обрезанное.
 *
 * Плоскость всегда кинематографичная (`cinema-surface`) — в обеих темах. Это роль
 * поверхности, а не тёмная тема: переключатель темы её не касается.
 *
 * `100dvh`, а не `100vh`: на iOS адресная строка меняет `vh` на ходу, и приколотый
 * экран дёргался бы при каждой прокрутке.
 *
 * Первый экран включает и поисковую строку — она приходит через `children` и
 * ставится последней, под содержимым (`.hero-viewport` в `globals.css`). В
 * прототипе она стоит на шве двух секций, и это давало сразу два дефекта: при
 * высоте hero в экран строка была видна наполовину, а в тёмной теме под ней
 * оставалась полоса фона страницы, читаемая как пустой чёрный брусок. Внутри
 * первого экрана шва нет: кадр и затемнение продолжаются под строкой до кромки.
 *
 * Со приколотым экраном у строки появилось второе свойство, которого не было
 * прежде: она остаётся на месте и работоспособной всё время раскрытия. Текст над
 * ней уходит, занавес открывается, а поиск доступен — то есть разгон не отнимает
 * у посетителя главное действие первого экрана.
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
    <HeroParallax className={cn('hero-stage', className)}>
      {/*
        `relative` здесь НЕТ намеренно. Утилита Tailwind объявляет
        `position: relative` и перебивает `position: sticky`, которое секция
        получает от `.hero-stage > .hero-viewport`: утилиты лежат в более позднем
        слое каскада и выигрывают. Экран тогда не прикалывается, а уезжает вверх
        вместе с раскрытием — то есть ровно тот дефект, из-за которого полоса
        разгона и появилась. Точка отсчёта для абсолютных детей при этом не
        теряется: `sticky` — тоже позиционированный элемент.
      */}
      <section className="hero-viewport cinema-surface overflow-hidden">
        <HeroVideo
          video={hero.video}
          reverseVideo={hero.reverseVideo}
          poster={hero.image}
          locale={locale}
        />

        {/*
          Затемнение держит текстовую колонку и отпускает кадр там, где стоит щель.
          Не растворяется по ходу раскрытия, а густеет: текст остаётся на виду до
          конца, а к концу за ним открытая сцена — самая светлая часть кадра.
        */}
        <div
          aria-hidden
          data-parallax="overlay"
          className="hero-curtain-scrim absolute inset-0 z-[1]"
        />

        {/*
          Содержимое занимает остаток экрана и центрируется в нём: верхний отступ
          отведён под фиксированную шапку, нижний — воздух до поисковой строки.

          Атрибута `data-parallax` здесь НЕТ намеренно. Текст не двигается и не
          гаснет по ходу раскрытия — решение заказчика от 05.09.2026. Ход вверх
          читался как отдельное движение, спорящее с раскрытием: занавес
          открывается, а надпись зачем-то ползёт. Контраст держит вуаль, которая
          густеет по мере прихода света.
        */}
        <div
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
