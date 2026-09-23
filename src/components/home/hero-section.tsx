/**
 * HERO — первый экран лендинга.
 *
 * Версия 21.09.2026: раскрытие занавеса прокруткой убрано (решение заказчика —
 * спортивный образ; приём с приколотым экраном блокировал прокрутку до конца
 * ролика). Первый экран снова занимает одну высоту окна и ведёт себя как
 * обычная секция: `HeroParallax` с его полосой разгона не нужен, слой
 * `data-parallax` не нужен — вуаль стоит в постоянной плотности, текст не
 * двигается и не гаснет, прокрутка свободна с первого пикселя.
 *
 * Плоскость остаётся кинематографичной (`cinema-surface`) в обеих темах — это
 * роль поверхности, а не тёмная тема: переключатель темы её не касается.
 *
 * `100dvh`, а не `100vh`: на iOS адресная строка меняет `vh` на ходу.
 *
 * Поисковая строка приходит через `children` и стоит последней, у нижней кромки
 * (`.hero-viewport` в `globals.css`): в прототипе она «наезжала» на шве двух
 * секций, и в тёмной теме под ней оставалась полоса фона страницы, читаемая
 * как пустой чёрный брусок. Внутри первого экрана шва нет.
 */

import { getTranslations } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';

import { HeroVideo } from '@/components/home/hero-video';
import { HeroParallaxFX } from '@/components/home/hero-parallax-fx';
import { Counter } from '@/components/fx/counter';
import { TextReveal } from '@/components/fx/text-reveal';
import { Button } from '@/components/ui/button';
import { routes } from '@/config';
import type { HomeContent } from '@/domain/content';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

/**
 * Порядок появления контента первого экрана, 0.12 с ступень — темп Enter-а
 * задаёт `--hero-enter-stagger` в `globals.css`. Порядок драматургии: имя на
 * афише → имя пьесы → аннотация → действия → цифры.
 */
const HERO_ENTER_ORDER = ['badge', 'title', 'subtitle', 'actions', 'stats'] as const;

/** Индекс элемента в порядке появления — CSS-переменная для `animation-delay`. */
function heroEnterOrder(name: (typeof HERO_ENTER_ORDER)[number]): CSSProperties {
  const index = HERO_ENTER_ORDER.indexOf(name);
  return { '--hero-enter-index': index } as CSSProperties;
}

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
    <section className={cn('hero-viewport cinema-surface relative overflow-hidden', className)}>
      {/*
        Движок глубины: пишет `--hero-parallax-*` и `--hero-exit-progress` на
        секцию. Сам невидим (`display: contents`) и стоит первым, чтобы переменные
        были объявлены до первого кадра отрисовки секции.
      */}
      <HeroParallaxFX />

      <HeroVideo video={hero.video} poster={hero.image} locale={locale} />

      {/*
        Затемнение держит текстовую колонку. Постоянная плотность — следствие
        отказа от слоя параллакса: гуще делать нечему, за текстом уже не открытая
        сцена, а тот же кадр.
      */}
      <div aria-hidden className="hero-scrim absolute inset-0 z-[1]" />

      {/*
        Золотой световой проход по кадру (см. `.hero-light-sweep` в `globals.css`):
        раз в 9 с по сцене проходит тёплая волна света — в такт блику на
        заголовке. Лежит над затемнением, но под контентом; при
        `prefers-reduced-motion` не показывается вовсе.
      */}
      <div aria-hidden data-slot="hero-light-sweep" className="hero-light-sweep" />

      <div className="hero-content page-container relative z-10 flex flex-1 flex-col items-start justify-center pt-24 pb-8 md:pt-28">
        <p style={heroEnterOrder('badge')} className="text-eyebrow text-metal mb-6 inline-flex items-center gap-2 rounded-full border border-metal-soft px-4 py-1.5 md:mb-8">
          {t('badge')}
        </p>

        <h1 style={heroEnterOrder('title')} className="text-display-hero mb-4 max-w-3xl text-content-on-cinema md:mb-6">
          <TextReveal>{t('titleLine1')}</TextReveal>
          <br />
          {/*
            Акцентный курсив — отдельный ключ перевода, а не HTML внутри
            строки: переводчик не должен редактировать разметку, а в армянском
            выделяется другое слово.

            `data-hero-shine` — золотой блик, идущий по слову раз в 7 с
            (см. `.hero-shine` в `globals.css`): главная страница встречает
            движением кадра, и заголовок отвечает ему тем же приёмом.
          */}
          <em data-hero-shine className="hero-shine text-accent-on-cinema italic"><TextReveal>{t('titleAccent')}</TextReveal></em>
        </h1>

        <p style={heroEnterOrder('subtitle')} className="text-body md:text-body-lg mb-8 max-w-lg text-content-on-cinema-muted md:mb-10">
          <TextReveal>{t('subtitle')}</TextReveal>
        </p>

        <div style={heroEnterOrder('actions')} className="flex flex-wrap gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.discover()}>{t('primaryCta')}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema" className="liquid-glass">
            <Link href={routes.instructors()}>{t('secondaryCta')}</Link>
          </Button>
        </div>

        {/*
          Показатели — список определений, а не набор div-ов: «12K+» само по
          себе ничего не значит, значение имеет пара «число — подпись», и
          скринридер читает её именно парой.
        */}
        <dl style={heroEnterOrder('stats')} className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-border-on-cinema pt-5 md:mt-10 md:gap-12 md:pt-6">
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
        не `z-10`: она интерактивна и обязана лежать выше затемнения.
      */}
      {children !== undefined && <div className="relative z-20 w-full">{children}</div>}
    </section>
  );
}
