/**
 * КАБИНЕТ КЛИЕНТА — обзор.
 *
 * Первый экран задачи 6.1 и одновременно то, чего не хватало входу: без него
 * успешный вход приводил на несуществующий адрес, а иконка «Account» в шапке
 * вела в 404.
 *
 * **Гвард здесь, а не только в `proxy.ts`.** Прокси перенаправляет по наличию
 * cookie — его можно подделать. `requireCaller()` проверяет подпись, срок и
 * `isActive`, и без него страница отдавала бы кабинет любому, кто поставил себе
 * cookie с нужным именем.
 *
 * **Пустые состояния, а не выдуманные брони.** Броней у нового аккаунта нет, и
 * показывать их неоткуда: `Booking` создаёт продукт, а не сид. Каждый блок
 * объясняет, что здесь будет, и даёт дорогу в каталог — это и есть содержимое
 * экрана на сегодня, а не заглушка.
 *
 * **Страница не кешируется и не индексируется.** `/account` есть и в
 * `privatePaths`, и в `noIndexPathPrefixes`: отданный CDN повторно ответ показал
 * бы одному человеку кабинет другого.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import { userRoleLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.account(),
    title: t('title'),
    noIndex: true,
  });
}

export default async function AccountPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  /*
   * Страница перенаправляет, а не бросает. `requireCaller()` уместен в server
   * action — там отказ это ответ на запрос; на странице он даёт экран ошибки
   * вместо формы входа. Дойти сюда без cookie нельзя (`proxy.ts` перенаправит), но
   * проверка обязана быть здесь: прокси смотрит только на наличие cookie, а не на
   * его подлинность, и просроченная сессия — это ровно тот случай.
   */
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.account()), locale: locale as Locale });
    /*
     * `redirect` бросает и наверх не возвращается, но его тип этого не выражает.
     * `return` нужен компилятору, чтобы сузить тип ниже: альтернатива — `!` в
     * каждой строке, то есть отключение проверки, которое однажды окажется неверным.
     */
    return null;
  }

  const user = caller;

  const t = await getTranslations('account');
  const tRoot = await getTranslations();
  const tNav = await getTranslations('nav');

  return (
    <>
      <SiteHeader />

      <main id={site.mainContentId} className="page-container py-12 md:py-16">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
            <h1 className="text-heading-2 mt-2">{user.name}</h1>
            <p className="text-body-sm mt-1 text-content-secondary">{user.email}</p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="metal" size="md">
              {tRoot(userRoleLabelKey(user.role))}
            </Badge>
            <SignOutButton />
          </div>
        </header>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section aria-labelledby="account-bookings">
            <h2 id="account-bookings" className="text-card-title mb-4">
              {t('bookings.title')}
            </h2>
            <EmptyState
              title={t('bookings.empty')}
              action={
                <Button asChild variant="accent">
                  <Link href={routes.classes()}>{t('bookings.emptyCta')}</Link>
                </Button>
              }
            />
          </section>

          <section aria-labelledby="account-orders">
            <h2 id="account-orders" className="text-card-title mb-4">
              {t('orders.title')}
            </h2>
            <EmptyState
              title={t('orders.empty')}
              action={
                <Button asChild variant="ghost">
                  <Link href={routes.shop()}>{tNav('shop')}</Link>
                </Button>
              }
            />
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
