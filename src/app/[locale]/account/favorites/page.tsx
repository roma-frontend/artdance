/**
 * ИЗБРАННОЕ — раздел кабинета.
 *
 * Экран существовал в навигации, но не в приложении: иконка ♡ в шапке и плитка
 * в мобильной шторке ведут на `routes.accountFavorites()`, а страницы по этому
 * адресу не было — щелчок по сердцу отдавал 404 с любой страницы сайта. Та же
 * ошибка, что когда-то была у иконки «Account», и лечится так же — экраном, а не
 * удалением ссылки: сохранять уже есть куда, `Favorite` в схеме объявлена.
 *
 * **Гвард здесь, а не только в `proxy.ts`.** Прокси смотрит на наличие cookie, а
 * `getCaller()` проверяет подпись, срок и `isActive`. Без этого страница отдала
 * бы чужое избранное любому, кто поставил себе cookie с нужным именем.
 *
 * **Четыре группы, а не один список.** Занятие, инструктор, площадка и товар —
 * разные карточки с разными действиями; свалить их в одну сетку значит показать
 * четыре разных объекта одинаковыми плитками. Пустая группа не рендерится —
 * пустой заголовок «Товары» без товаров это шум, а не информация.
 *
 * Страница приватная: `/account` уже перечислен и в `privatePaths`, и в
 * `noIndexPathPrefixes`, префикс покрывает вложенные адреса.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ClassCard } from '@/components/catalog/class-card';
import { InstructorCard } from '@/components/catalog/instructor-card';
import { VenueCard } from '@/components/catalog/venue-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { SiteFooter } from '@/components/layout/site-footer';
import { ProductCard } from '@/components/shop/product-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { getFavorites } from '@/server/queries/favorites';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'favorites' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.accountFavorites(),
    title: t('title'),
    noIndex: true,
  });
}

export default async function FavoritesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountFavorites()), locale: locale as Locale });
    /* `redirect` бросает, но его тип этого не выражает — `return` сужает тип ниже. */
    return null;
  }

  const favorites = await getFavorites(caller.id);

  const t = await getTranslations('favorites');
  const tNav = await getTranslations('nav');

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <header>
          <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
          <h1 className="text-heading-2 mt-2">{t('title')}</h1>
        </header>

        {favorites.total === 0 ? (
          <div className="mt-10">
            <EmptyState
              title={t('empty')}
              description={t('emptyHint')}
              action={
                <Button asChild variant="accent">
                  <Link href={routes.discover()}>{tNav('discover')}</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-10 flex flex-col gap-12">
            {favorites.classes.length > 0 && (
              <FavoriteGroup title={tNav('classes')} labelId="favorites-classes">
                {favorites.classes.map((item) => (
                  <li key={item.slug}>
                    <CardTilt>
                      <ClassCard item={item} locale={locale as Locale} />
                    </CardTilt>
                  </li>
                ))}
              </FavoriteGroup>
            )}

            {favorites.instructors.length > 0 && (
              <FavoriteGroup title={tNav('instructors')} labelId="favorites-instructors">
                {favorites.instructors.map((item) => (
                  <li key={item.slug}>
                    <CardTilt>
                      <InstructorCard item={item} locale={locale as Locale} />
                    </CardTilt>
                  </li>
                ))}
              </FavoriteGroup>
            )}

            {favorites.venues.length > 0 && (
              <FavoriteGroup title={tNav('studios')} labelId="favorites-venues">
                {favorites.venues.map((item) => (
                  <li key={item.slug}>
                    <CardTilt>
                      <VenueCard item={item} locale={locale as Locale} />
                    </CardTilt>
                  </li>
                ))}
              </FavoriteGroup>
            )}

            {favorites.products.length > 0 && (
              <FavoriteGroup title={tNav('shop')} labelId="favorites-products">
                {favorites.products.map((item) => (
                  <li key={item.slug}>
                    <CardTilt>
                      <ProductCard item={item} locale={locale as Locale} />
                    </CardTilt>
                  </li>
                ))}
              </FavoriteGroup>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * Группа избранного. Сетка та же, что в каталоге (три колонки на широком
 * экране): карточка та же самая, и менять её плотность в кабинете значит
 * получить два разных представления одного объекта.
 */
function FavoriteGroup({
  title,
  labelId,
  children,
}: {
  title: string;
  labelId: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={labelId}>
      <h2 id={labelId} className="text-card-title mb-5">
        {title}
      </h2>
      <ul className="grid gap-5 xs:grid-cols-2 lg:grid-cols-3">{children}</ul>
    </section>
  );
}
