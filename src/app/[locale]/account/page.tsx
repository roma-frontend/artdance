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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Price } from '@/components/ui/price';
import { StatusBadge } from '@/components/data/status-badge';
import { routes, site } from '@/config';
import { hasAtLeastRole, userRoleLabelKey } from '@/domain/enums';
import { bookingStatuses, type BookingStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';

import { ViewToggle } from '@/components/account/view-toggle';
import { resolveAccountView } from '@/components/account/view-toggle.helpers';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

export default async function AccountPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  setRequestLocale(locale as Locale);
  const view = resolveAccountView(sp);

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
  const tCommon = await getTranslations('common');
  const tRoot = await getTranslations();
  const tNav = await getTranslations('nav');
  const isBookingStatus = (v: string): v is BookingStatus => (bookingStatuses as readonly string[]).includes(v);

  const [bookings, orders] = await Promise.all([
    db.booking.findMany({
      where: { customerId: caller.id },
      orderBy: { startsAt: 'desc' },
      take: 4,
      select: {
        id: true,
        reference: true,
        status: true,
        startsAt: true,
        endsAt: true,
        totalPrice: true,
        instructor: { select: { user: { select: { name: true } } } },
        session: { select: { danceClass: { select: { title: true } } } },
      },
    }),
    db.order.findMany({
      where: { userId: caller.id },
      orderBy: { placedAt: 'desc' },
      take: 3,
      select: { id: true, orderNumber: true, status: true, total: true, placedAt: true },
    }),
  ]);

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page min-w-0">
        <header className="flex min-w-0 flex-wrap items-start justify-between gap-4 sm:gap-6 my-4">
          <div className="min-w-0">
            <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
            <h1 className="text-heading-2 mt-2 break-words [overflow-wrap:anywhere]">{user.name}</h1>
            <p className="text-body-sm mt-1 break-all text-content-secondary [overflow-wrap:anywhere]">{user.email}</p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <Badge variant="metal" size="md" className="max-w-full break-words">
              {tRoot(userRoleLabelKey(user.role))}
            </Badge>
            {hasAtLeastRole(user.role, 'SUPPORT') && (
              <Button asChild variant="outline" size="sm" className="max-w-full">
                <Link href={routes.admin()}>{t('staffCta')}</Link>
              </Button>
            )}
            <SignOutButton />
          </div>
        </header>

        <div className="mt-6 flex min-w-0 items-center justify-end">
          <ViewToggle value={view} />
        </div>

        <div className={view === 'grid' ? 'mt-6 grid min-w-0 gap-6 md:grid-cols-2' : 'mt-6 grid min-w-0 gap-6'}>
          <section aria-labelledby="account-bookings">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="account-bookings" className="text-card-title">
                {t('bookings.title')}
              </h2>
              {bookings.length > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={routes.accountBookings()}>{tCommon('actions.viewAll')}</Link>
                </Button>
              ) : null}
            </div>
            {bookings.length === 0 ? (
              <EmptyState
                title={t('bookings.empty')}
                action={
                  <Button asChild variant="accent">
                    <Link href={routes.classes()}>{t('bookings.emptyCta')}</Link>
                  </Button>
                }
              />
            ) : view === 'grid' ? (
              <ul className="grid gap-3">
                {bookings.map((b) => {
                  const classTitle = (b as { session?: { danceClass?: { title?: string } } | null }).session?.danceClass?.title;
                  const instructorName = (b as { instructor?: { user?: { name?: string } } | null }).instructor?.user?.name;
                  const when = new Date(b.startsAt).toLocaleString(locale as Locale, {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                    return (
                      <li key={b.id} className="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface-card p-4 shadow-sm">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="min-w-0 break-all font-mono text-body-sm font-semibold">{b.reference}</span>
                              {isBookingStatus(b.status) ? <StatusBadge kind="booking" status={b.status} size="sm" className="max-w-full" /> : <Badge variant="neutral" size="sm" className="max-w-full break-words">{b.status}</Badge>}
                            </div>
                            {(classTitle || instructorName) && <p className="text-body-sm mt-1 break-words text-content-secondary [overflow-wrap:anywhere]">{[classTitle, instructorName].filter(Boolean).join(' · ')}</p>}
                            <p className="text-body-sm mt-1 break-words font-medium [overflow-wrap:anywhere]">{when}</p>
                          </div>
                          <Price amount={b.totalPrice} emphasis="total" className="shrink-0" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild variant="outline" size="sm" className="max-w-full"><Link href={routes.accountBooking(b.id)}>{tCommon('actions.viewDetails')}</Link></Button>
                          <Button asChild variant="ghost" size="sm" className="max-w-full"><Link href={routes.bookingPass(b.id)}>Pass</Link></Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
            ) : (
              <>
                {/* Desktop table */}
                <ul className="hidden divide-y divide-border-default overflow-hidden rounded-xl border border-border-default bg-surface-card sm:block">
                  {bookings.map((b) => {
                    const classTitle = (b as { session?: { danceClass?: { title?: string } } | null }).session?.danceClass?.title;
                    const whenShort = new Date(b.startsAt).toLocaleString(locale as Locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                    return (
                      <li key={b.id} className="flex min-w-0 items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken">
                        <span className="shrink-0 font-mono text-body-sm font-semibold">{b.reference}</span>
                        {isBookingStatus(b.status) ? <StatusBadge kind="booking" status={b.status} size="sm" /> : <Badge variant="neutral" size="sm">{b.status}</Badge>}
                        {classTitle ? <span className="min-w-0 flex-1 truncate text-body-sm text-content-tertiary">{classTitle}</span> : <span className="min-w-0 flex-1" aria-hidden />}
                        <span className="ml-auto shrink-0 text-body-sm font-medium tabular-nums">{whenShort}</span>
                        <Price amount={b.totalPrice} emphasis="total" />
                        <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 px-2"><Link href={routes.accountBooking(b.id)}>{tCommon('actions.viewDetails')}</Link></Button>
                        <Button asChild variant="outline" size="sm" className="h-7 shrink-0 px-2"><Link href={routes.bookingPass(b.id)}>Pass</Link></Button>
                      </li>
                    );
                  })}
                </ul>
                {/* Mobile cards — same data, no hidden columns */}
                <ul className="grid gap-3 sm:hidden">
                  {bookings.map((b) => {
                    const classTitle = (b as { session?: { danceClass?: { title?: string } } | null }).session?.danceClass?.title;
                    const instructorName = (b as { instructor?: { user?: { name?: string } } | null }).instructor?.user?.name;
                    const whenShort = new Date(b.startsAt).toLocaleString(locale as Locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                    return (
                      <li key={b.id} className="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface-card p-3 shadow-sm">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <span className="min-w-0 break-all font-mono text-caption font-semibold">{b.reference}</span>
                          {isBookingStatus(b.status) ? <StatusBadge kind="booking" status={b.status} size="sm" className="max-w-[50%]" /> : <Badge variant="neutral" size="sm" className="max-w-[50%] break-words">{b.status}</Badge>}
                        </div>
                        {(classTitle || instructorName) && <p className="mt-1.5 break-words text-body-sm text-content-secondary [overflow-wrap:anywhere]">{[classTitle, instructorName].filter(Boolean).join(' · ')}</p>}
                        <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
                          <span className="break-words text-caption font-medium tabular-nums text-content-tertiary [overflow-wrap:anywhere]">{whenShort}</span>
                          <Price amount={b.totalPrice} emphasis="total" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild variant="ghost" size="sm" className="flex-1"><Link href={routes.accountBooking(b.id)}>{tCommon('actions.viewDetails')}</Link></Button>
                          <Button asChild variant="outline" size="sm" className="flex-1"><Link href={routes.bookingPass(b.id)}>Pass</Link></Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="account-orders">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="account-orders" className="text-card-title">
                {t('orders.title')}
              </h2>
              {orders.length > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={routes.accountOrders()}>{tCommon('actions.viewAll')}</Link>
                </Button>
              ) : null}
            </div>
            {orders.length === 0 ? (
              <EmptyState
                title={t('orders.empty')}
                action={
                  <Button asChild variant="ghost">
                    <Link href={routes.shop()}>{tNav('shop')}</Link>
                  </Button>
                }
              />
            ) : view === 'grid' ? (
              <ul className="grid min-w-0 gap-3">
                {orders.map((o) => (
                  <li key={o.id} className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-border-default bg-surface-card px-4 py-3 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-body-sm font-semibold [overflow-wrap:anywhere]">{o.orderNumber}</p>
                      <p className="break-words text-caption text-content-tertiary [overflow-wrap:anywhere]">{new Date(o.placedAt).toLocaleDateString(locale as Locale)} · {o.status}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-body-sm font-semibold"><Price amount={o.total} /></p>
                      <p className="text-caption text-content-tertiary">{o.status}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <ul className="hidden divide-y divide-border-default overflow-hidden rounded-xl border border-border-default bg-surface-card sm:block">
                  {orders.map((o) => (
                    <li key={o.id} className="flex min-w-0 items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken">
                      <span className="shrink-0 font-mono text-body-sm font-semibold">{o.orderNumber}</span>
                      <Badge variant="neutral" size="sm">{o.status}</Badge>
                      <span className="ml-auto shrink-0 text-caption text-content-tertiary">{new Date(o.placedAt).toLocaleDateString(locale as Locale)}</span>
                      <Price amount={o.total} emphasis="total" />
                      <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 px-2"><Link href={routes.accountOrder(o.orderNumber)}>{tCommon('actions.viewDetails')}</Link></Button>
                    </li>
                  ))}
                </ul>
                <ul className="grid gap-3 sm:hidden">
                  {orders.map((o) => (
                    <li key={o.id} className="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface-card p-3 shadow-sm">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="min-w-0 break-all font-mono text-caption font-semibold">{o.orderNumber}</span>
                        <Badge variant="neutral" size="sm" className="max-w-[50%] break-words">{o.status}</Badge>
                      </div>
                      <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
                        <span className="text-caption text-content-tertiary">{new Date(o.placedAt).toLocaleDateString(locale as Locale)}</span>
                        <Price amount={o.total} emphasis="total" />
                      </div>
                      <Button asChild variant="ghost" size="sm" className="mt-3 w-full"><Link href={routes.accountOrder(o.orderNumber)}>{tCommon('actions.viewDetails')}</Link></Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
