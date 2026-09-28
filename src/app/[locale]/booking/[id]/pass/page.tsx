/**
 * BOOKING PASS — A-06: пропуск брони (QR/штрих, детали, адрес).
 * Доступен владельцу брони или админу. QR — заглушка до подключения библиотеки.
 */

import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.bookingPass(id), title: t('passTitle'), noIndex: true });
}

export default async function BookingPassPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });

  const caller = await getCaller();
  if (!caller) {
    const { redirect } = await import('@/i18n/routing');
    redirect({ href: routes.signIn(routes.bookingPass(id)), locale: locale as Locale } as never);
    return null;
  }

  const booking = await db.booking.findUnique({
    where: { id },
    select: { id: true, reference: true, status: true, startsAt: true, endsAt: true, customerId: true, instructorId: true, venueId: true },
  });
  if (!booking) notFound();
  const isOwner = booking.customerId === caller.id;
  const isStaff = caller.role === 'ADMIN' || caller.role === 'SUPPORT';
  if (!isOwner && !isStaff) notFound();

  const icsHref = `/api/ics/${booking.id}`;

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <div className="mx-auto max-w-lg rounded-xl border border-border-default bg-surface-card p-6 shadow-md">
        <div className="flex items-center justify-between">
          <h1 className="text-heading-3">{t('passTitle')}</h1>
          <Badge variant="metal">{booking.status}</Badge>
        </div>
        <dl className="text-body-sm mt-4 space-y-2">
          <div className="flex justify-between"><dt className="text-content-tertiary">{t('bookingLabel')}</dt><dd className="font-mono font-semibold">{booking.reference}</dd></div>
          <div className="flex justify-between"><dt className="text-content-tertiary">{t('startsLabel')}</dt><dd className="font-semibold">{new Date(booking.startsAt).toLocaleString(locale)}</dd></div>
          <div className="flex justify-between"><dt className="text-content-tertiary">{t('endsLabel')}</dt><dd className="font-semibold">{new Date(booking.endsAt).toLocaleString(locale)}</dd></div>
        </dl>
        <div className="mt-6 flex justify-center rounded-lg border border-dashed border-border-default bg-surface-sunken p-8">
          <div className="text-center">
            <div className="mx-auto size-32 rounded-md bg-content-primary/10" aria-hidden />
            <p className="text-caption mt-3 font-mono text-content-tertiary">{booking.reference}</p>
            <p className="text-caption text-content-tertiary">{t('qrSoon')}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="accent"><a href={icsHref}>{t('addToCalendar')}</a></Button>
          <Button asChild variant="outline"><Link href={routes.accountBookings()}>Мои брони</Link></Button>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
