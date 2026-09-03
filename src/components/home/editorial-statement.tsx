/**
 * EDITORIAL STATEMENT — полноэкранное заявление бренда.
 *
 * Секция не зависит от темы: это `surface-cinema`, отдельная роль, а не тёмная
 * тема. В светлой теме она такая же чёрная — так задумано в брендгайде, и
 * переключатель темы на неё не влияет.
 *
 * Фотография — фон, а не контент: у неё пустой `alt` и она приглушена до 30% с
 * лёгким размытием, поверх лежит радиальный scrim из токенов. Медленное
 * приближение (эффект Кена Бёрнса) добавляет жизни неподвижному кадру и
 * выключается при `prefers-reduced-motion`.
 */

import { useTranslations } from 'next-intl';

import { Reveal } from '@/components/fx/reveal';
import { SectionParallax } from '@/components/fx/section-parallax';
import { Button } from '@/components/ui/button';
import { Media } from '@/components/ui/media';
import { routes } from '@/config';
import { resolveMedia, type MediaRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';

interface EditorialStatementProps {
  image: MediaRef;
  locale: Locale;
}

export function EditorialStatement({ image, locale }: EditorialStatementProps) {
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
          <Media
            {...resolveMedia(image, locale)}
            /* Фон, а не иллюстрация: описание не нужно, нужен только кадр. */
            alt=""
            preset="editorialFullBleed"
            fill
            className="editorial-backdrop absolute inset-0 size-full"
          />
        </div>

        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'var(--scrim-editorial-radial)' }}
        />

        {/* Содержимое идёт втрое медленнее кадра, заголовок — ещё медленнее. */}
        <div data-parallax="content" className="relative">
          <Reveal variant="scale" className="page-container">
            <h2 data-parallax="heading" className="text-display-editorial uppercase">
              {t('titleLine1')} {t('titleLine2')}{' '}
              <span className="text-accent-on-cinema">{t('titleAccent')}</span>
            </h2>
            <p className="text-body-lg mt-4 text-content-on-cinema-muted">{t('subtitle')}</p>
            <Button asChild className="mt-8" size="lg" variant="accent">
              <Link href={routes.classes()}>{t('cta')}</Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </SectionParallax>
  );
}
