/**
 * BOOKING PASS — A-06: пропуск брони (QR + билет, детали, чекин).
 * Доступен владельцу брони или админу. QR подписан (HMAC), верификация и чекин — по /api/booking/pass/verify.
 */

import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { PassTicket } from '@/components/pass/pass-ticket';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { clientEnv } from '@/config/env';
import { signPassToken, verifyPassToken } from '@/server/booking/pass-token';
import { qrSvgString } from '@/lib/qr/render';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

function resolveBookingTitle(
  booking: {
    subject?: string | null;
    session?: { danceClass?: { title?: string | null; translations?: Array<{ locale: string; title: string }> } | null } | null;
    event?: { title?: string | null; translations?: Array<{ locale: string; title: string }> } | null;
    venue?: { name?: string | null; translations?: Array<{ locale: string; name: string }> } | null;
    room?: { name?: string | null } | null;
    instructor?: { user?: { name?: string | null } | null } | null;
  } | null,
  locale: string,
): string | null {
  if (!booking) return null;
  // Групповое занятие — название из DanceClass (с переводом)
  const classTr = booking.session?.danceClass?.translations?.find((t) => t.locale === locale)?.title;
  const classTitle = classTr ?? booking.session?.danceClass?.title ?? null;
  if (classTitle) return classTitle;

  // Событие — название из Event
  const eventTr = booking.event?.translations?.find((t) => t.locale === locale)?.title;
  const eventTitle = eventTr ?? booking.event?.title ?? null;
  if (eventTitle) return eventTitle;

  // Аренда зала — площадка / зал
  const venueTr = booking.venue?.translations?.find((t) => t.locale === locale)?.name;
  const venueName = venueTr ?? booking.venue?.name ?? null;
  const roomName = booking.room?.name ?? null;
  if (booking.subject === 'STUDIO_RENTAL') {
    if (venueName && roomName) return `${venueName} · ${roomName}`;
    if (venueName) return venueName;
    if (roomName) return roomName;
  }

  // Приват — fallback к инструктору
  if (booking.subject === 'PRIVATE_SESSION' && booking.instructor?.user?.name) {
    return booking.instructor.user.name;
  }

  return venueName ?? booking.instructor?.user?.name ?? null;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  try {
    const booking = (await db.booking.findUnique({
      where: { id },
      select: {
        reference: true,
        subject: true,
        session: { select: { danceClass: { select: { title: true, translations: { select: { locale: true, title: true } } } } } },
        event: { select: { title: true, translations: { select: { locale: true, title: true } } } },
        venue: { select: { name: true, translations: { select: { locale: true, name: true } } } },
        room: { select: { name: true } },
        instructor: { select: { user: { select: { name: true } } } },
      },
    })) ??
      (await db.booking.findUnique({
        where: { reference: id },
        select: {
          reference: true,
          subject: true,
          session: { select: { danceClass: { select: { title: true, translations: { select: { locale: true, title: true } } } } } },
          event: { select: { title: true, translations: { select: { locale: true, title: true } } } },
          venue: { select: { name: true, translations: { select: { locale: true, name: true } } } },
          room: { select: { name: true } },
          instructor: { select: { user: { select: { name: true } } } },
        },
      }));
    const bookingTitle = resolveBookingTitle(booking as never, locale);
    const title = bookingTitle ? `${bookingTitle} — ${t('passTitle')}` : `${t('passTitle')} · ${booking?.reference ?? id}`;
    return buildMetadata({ locale: locale as Locale, path: routes.bookingPass(id), title, noIndex: true });
  } catch {
    return buildMetadata({ locale: locale as Locale, path: routes.bookingPass(id), title: t('passTitle'), noIndex: true });
  }
}

export default async function BookingPassPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const tAccount = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const tStatus = await getTranslations({ locale: locale as Locale, namespace: 'status' });

  const caller = await getCaller();
  if (!caller) {
    const { redirect } = await import('@/i18n/routing');
    redirect({ href: routes.signIn(routes.bookingPass(id)), locale: locale as Locale } as never);
    return null;
  }

  const booking =
    (await db.booking.findUnique({
      where: { id },
      select: {
        id: true,
        reference: true,
        status: true,
        subject: true,
        startsAt: true,
        endsAt: true,
        checkInAt: true,
        customerId: true,
        instructorId: true,
        venueId: true,
        venue: { select: { name: true, addressLine: true, city: true, translations: { select: { locale: true, name: true } } } },
        room: { select: { name: true } },
        instructor: { select: { user: { select: { name: true } } } },
        session: { select: { danceClass: { select: { title: true, translations: { select: { locale: true, title: true } } } } } },
        event: { select: { title: true, translations: { select: { locale: true, title: true } } } },
      },
    })) ??
    (await db.booking.findUnique({
      where: { reference: id },
      select: {
        id: true,
        reference: true,
        status: true,
        subject: true,
        startsAt: true,
        endsAt: true,
        checkInAt: true,
        customerId: true,
        instructorId: true,
        venueId: true,
        venue: { select: { name: true, addressLine: true, city: true, translations: { select: { locale: true, name: true } } } },
        room: { select: { name: true } },
        instructor: { select: { user: { select: { name: true } } } },
        session: { select: { danceClass: { select: { title: true, translations: { select: { locale: true, title: true } } } } } },
        event: { select: { title: true, translations: { select: { locale: true, title: true } } } },
      },
    }));
  if (!booking) notFound();
  const isOwner = booking.customerId === caller.id;
  const isStaff = caller.role === 'ADMIN' || caller.role === 'SUPPORT';
  if (!isOwner && !isStaff) notFound();

  const icsHref = `/api/ics/${booking.id}`;
  const base = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');

  // Токен живой 24h; страница каждый раз генерит свежий — скриншот старого истечёт, но чекин остаётся.
  const token = signPassToken(booking.id);
  const qrData = `${base}/studio/check-in?token=${encodeURIComponent(token)}`;
  const svg = await qrSvgString(qrData, 208);

  const venueText =
    ([booking.venue?.addressLine, booking.venue?.city].filter(Boolean).join(', ') || (booking.venue as { translations?: Array<{ locale: string; name: string }>; name?: string | null })?.translations?.find((tr) => tr.locale === locale)?.name || booking.venue?.name) ?? null;
  const instructorText = booking.instructor?.user.name ?? null;
  const startsText = new Date(booking.startsAt).toLocaleString(locale);
  const endsText = new Date(booking.endsAt).toLocaleString(locale);
  const checkedInAtText = booking.checkInAt ? new Date(booking.checkInAt).toLocaleString(locale) : null;

  const isCancelled = booking.status === 'CANCELLED_BY_CUSTOMER' || booking.status === 'CANCELLED_BY_PROVIDER';
  const isCheckedIn = Boolean(booking.checkInAt);
  const verify = verifyPassToken(token);
  const isExpired = !verify.ok && verify.reason === 'EXPIRED';

  const qrState = isCancelled ? 'cancelled' : isCheckedIn ? 'checkedIn' : isExpired ? 'expired' : 'ready';

  const statusLabel = (() => {
    if (isCheckedIn) return t('qrCheckedIn');
    if (booking.status === 'CANCELLED_BY_CUSTOMER') return tStatus('booking.cancelledByCustomer');
    if (booking.status === 'CANCELLED_BY_PROVIDER') return tStatus('booking.cancelledByProvider');
    if (booking.status === 'CONFIRMED') return tStatus('booking.confirmed');
    if (booking.status === 'PENDING') return tStatus('booking.pending');
    if (booking.status === 'COMPLETED') return tStatus('booking.completed');
    if (booking.status === 'RESCHEDULED') return tStatus('booking.rescheduled');
    if (booking.status === 'WAITLISTED') return tStatus('booking.waitlisted');
    if (booking.status === 'EXPIRED') return tStatus('booking.expired');
    if (booking.status === 'NO_SHOW') return tStatus('booking.noShow');
    return booking.status;
  })();

  const bookingTitle = resolveBookingTitle(booking as never, locale);

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <PassTicket
        bookingTitle={bookingTitle}
        passTitle={t('passTitle')}
        bookingLabel={t('bookingLabel')}
        startsLabel={t('startsLabel')}
        endsLabel={t('endsLabel')}
        venueLabel={tCommon('labels.location')}
        instructorLabel={tCommon('labels.instructor')}
        expiredLabel={t('qrExpired')}
        copyLabel={t('copyCode')}
        printLabel={t('printPass')}
        statusLabel={statusLabel}
        reference={booking.reference}
        startsText={startsText}
        endsText={endsText}
        venueText={venueText}
        instructorText={instructorText}
        qrSvg={svg}
        qrRef={booking.reference}
        qrState={qrState}
        checkedInAtText={checkedInAtText}
        onCopyRef="1"
        onPrint="1"
        icsHref={icsHref}
        addToCalendarLabel={t('addToCalendar')}
        myBookingsLabel={tAccount('bookings.title')}
        myBookingsHref={routes.accountBookings()}
        footerTip={t('passFooterTip')}
        cancelledHint={t('qrCancelledHint')}
        checkedInLabel={t('qrCheckedIn')}
      />
      {/* Фолбэк линк если билет не нужен */}
      <p className="mx-auto mt-4 max-w-prose text-center text-caption text-content-tertiary">
        <Link href={routes.accountBookings()} className="underline decoration-border-default underline-offset-4 hover:decoration-accent">
          {tAccount('bookings.title')}
        </Link>
      </p>
      <SiteFooter />
    </main>
  );
}
