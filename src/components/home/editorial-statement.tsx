/**
 * EDITORIAL STATEMENT — полноэкранное заявление бренда.
 *
 * Секция не зависит от темы: это `surface-cinema`, отдельная роль, а не тёмная
 * тема. В светлой теме она такая же чёрная — так задумано в брендгайде, и
 * переключатель темы на неё не влияет.
 *
 * Фон — фоновая петля с постером (`EditorialVideo`). В прототипе здесь статичная
 * фотография; клип пришёл от заказчика 04.09.2026, отклонение согласовано —
 * `docs/00-decision-record.md` §8. При `prefers-reduced-motion` и при экономии
 * данных остаётся постер, то есть ровно то, что было в макете.
 *
 * Кадр — фон, а не контент: у него пустой `alt`, он приглушён и растворён к
 * краям, поверх лежит радиальный scrim из токенов и вуаль под текстом.
 */

import { useTranslations } from 'next-intl';

import { EditorialVideo } from '@/components/home/editorial-video';
import { Reveal } from '@/components/fx/reveal';
import { SectionParallax } from '@/components/fx/section-parallax';
import { Button } from '@/components/ui/button';
import { routes } from '@/config';
import type { MediaRef, VideoRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';

interface EditorialStatementProps {
  /** Фоновая петля. `null` до кодирования — тогда остаётся постер. */
  video: VideoRef | null;
  /** Постер петли и он же фоллбэк. */
  image: MediaRef;
  locale: Locale;
}

export function EditorialStatement({ video, image, locale }: EditorialStatementProps) {
  const t = useTranslations('home.editorial');

  return (
    /*
     * Обёртка параллакса охватывает всю секцию: ход слоёв считается от её
     * положения в окне, а роли раздаются атрибутом `data-parallax`.
     */
    <SectionParallax>
      <section className="cinema-surface section-y-wide relative overflow-hidden text-center">
        {/*
          Кадр — самый быстрый слой (200px за проход) и потому самый заметный.
          Увеличение на 20% задаёт эффект: без запаса ход открыл бы полосу у
          кромки секции.
        */}
        <div aria-hidden data-parallax="background" className="absolute inset-0">
          <EditorialVideo video={video} poster={image} locale={locale} />
        </div>

        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'var(--scrim-editorial-radial)' }}
        />

        {/*
          Вуаль под текстом. Отдельным слоем от scrim выше, потому что задачи
          разные: тот задаёт тональность кадра, эта гарантирует контраст
          заголовка над движущимся изображением, яркость которого меняется на
          каждом кадре.
        */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'var(--scrim-editorial-copy)' }}
        />

        {/* Содержимое идёт втрое медленнее кадра, заголовок — ещё медленнее. */}
        <div data-parallax="content" className="relative">
          <Reveal variant="scale" className="page-container">
            <h2 data-parallax="heading" className="text-display-editorial uppercase">
              {t('titleLine1')} {t('titleLine2')}{' '}
              <span className="editorial-accent text-accent-on-cinema">{t('titleAccent')}</span>
            </h2>
            {/*
              Подзаголовок в ПОЛНУЮ силу, а не приглушённый.

              В макете это `rgba(255,255,255,0.45)` поверх статичной фотографии,
              приглушённой до 30%: там подложка тёмная и постоянная, и 45% белого
              читались. За живым кадром подложка меняется каждый кадр, и на
              светлых участках — бордовое платье в контровом свете — приглушённый
              вариант пропадал. Иерархия при этом не теряется: заголовок отличается
              кеглем в четыре раза и весом 900 против 400.
            */}
            <p className="text-body-lg mt-4 text-content-on-cinema">{t('subtitle')}</p>
            <Button asChild className="mt-8" size="lg" variant="accent">
              <Link href={routes.classes()}>{t('cta')}</Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </SectionParallax>
  );
}
