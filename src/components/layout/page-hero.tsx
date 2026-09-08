/**
 * PAGE HERO — баннер внутренней страницы.
 *
 * Отдельный компонент, а не копия первого экрана главной: у баннера раздела нет
 * ни видео, ни показателей, ни параллакса, ни раскрытия — только кадр, затемнение
 * и заголовок первого уровня. Общий компонент с hero главной означал бы десяток
 * необязательных пропсов, из которых на каждой странице используются два.
 *
 * Три решения, которые стоит знать.
 *
 * **Высота шапки — токен, а не распорка.** В прототипе перед баннером стоит
 * пустой `div.hero-spacer`; здесь отступ равен `--layout-nav-height`. Распорка
 * молча ломается при смене высоты шапки, а токен меняется в одном месте.
 *
 * **Баннер тёмный в обеих темах.** Это `surface-cinema`, а не тема: шапка над
 * кинематографичным первым экраном рассчитывает на тёмный фон под собой
 * (`hasCinemaHero` в `config/navigation.ts`), и светлый баннер в светлой теме
 * заставил бы её красить тёмный текст по светлому — то самое, от чего
 * `use-cinema-hero-behind` и защищает.
 *
 * **Хлебные крошки — часть баннера, а не отдельная полоса.** Их место —
 * над заголовком: так они не занимают собственную строку на телефоне и не
 * отделяют заголовок от контента.
 */

import { useTranslations } from 'next-intl';
import { Fragment, type ReactNode } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Media } from '@/components/ui/media';
import { routes } from '@/config';
import { resolveMedia, type MediaRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { Crumb } from '@/lib/seo/jsonld';
import { cn } from '@/lib/utils';

export interface BreadcrumbEntry {
  label: string;
  /** Отсутствие ссылки означает текущую страницу — она не кликается. */
  href?: string;
}

/**
 * Хлебные крошки из того же массива, что уходит в структурированные данные.
 *
 * Крошки на экране и `BreadcrumbList` в JSON-LD обязаны совпадать: Google
 * сравнивает разметку с видимой страницей, и расхождение — это либо потерянная
 * навигационная строка в выдаче, либо предупреждение о недостоверной разметке.
 * Поэтому страница описывает путь один раз (`Crumb[]`), а не дважды.
 *
 * Последняя крошка теряет ссылку: это текущая страница.
 */
export function breadcrumbsFromTrail(trail: readonly Crumb[]): BreadcrumbEntry[] {
  return trail.map((crumb, index) =>
    index === trail.length - 1 ? { label: crumb.name } : { label: crumb.name, href: crumb.path },
  );
}

interface PageHeroProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  /**
   * Кадр баннера. Отсутствие — легальное состояние: у правовых и служебных
   * разделов фотографии нет, и заглушка вместо неё была бы шумом.
   */
  image?: MediaRef | null;
  locale: Locale;
  breadcrumbs?: readonly BreadcrumbEntry[];
  /** Дополнительный блок под заголовком: счётчик, кнопка, поисковая строка. */
  children?: ReactNode;
  className?: string;
}

export function PageHero({
  title,
  subtitle,
  eyebrow,
  image,
  locale,
  breadcrumbs,
  children,
  className,
}: PageHeroProps) {
  const t = useTranslations();

  return (
    <section
      className={cn(
        'cinema-surface relative isolate overflow-hidden',
        /* Высота из содержимого, но не ниже комфортного минимума. */
        'flex min-h-70 flex-col justify-end md:min-h-90',
        className,
      )}
    >
      {image && (
        <>
          <Media
            {...resolveMedia(image, locale)}
            preset="heroFullBleed"
            fill
            className="absolute inset-0 -z-20 size-full"
            /*
             * Кадр приглушён: поверх него лежит заголовок, и снимок в полную силу
             * съедает контраст. Значение то же, что у затемнения в прототипе.
             */
            imageClassName="brightness-[0.45]"
          />
          {/*
            Второй слой — вертикальный градиент от прозрачного к тёмному. Только
            яркости кадру мало: светлое небо в верхней части снимка всё равно
            подсвечивает мелкие крошки.
          */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-linear-to-t from-surface-cinema via-surface-cinema/60 to-surface-cinema/20"
          />
        </>
      )}

      <div
        className={cn(
          'page-container w-full',
          /* Отступ сверху равен высоте шапки: она лежит поверх баннера. */
          'pt-(--layout-nav-height) pb-10 md:pb-14',
        )}
      >
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb label={t('a11y.breadcrumbNav')} className="mb-5">
            <BreadcrumbList className="text-content-on-cinema-muted">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="hover:text-content-on-cinema">
                  <Link href={routes.home()}>{t('nav.home')}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>

              {breadcrumbs.map((entry) => (
                <Fragment key={`${entry.href ?? 'current'}-${entry.label}`}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {entry.href ? (
                      <BreadcrumbLink asChild className="hover:text-content-on-cinema">
                        <Link href={entry.href}>{entry.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-content-on-cinema">
                        {entry.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {eyebrow !== undefined && (
          <p className="eyebrow-rule text-eyebrow mb-3 text-metal">{eyebrow}</p>
        )}

        <h1 className="text-heading-1 max-w-(--layout-content-max-width) text-content-on-cinema">
          {title}
        </h1>

        {subtitle !== undefined && (
          <p className="text-body-lg mt-3 max-w-(--layout-prose-max-width) text-content-on-cinema-muted">
            {subtitle}
          </p>
        )}

        {children !== undefined && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
