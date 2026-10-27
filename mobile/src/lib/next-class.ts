import type { Locale } from '@/i18n/config';

import { canCancelBooking, type ClientBooking } from './bookings';
import { dateLabel } from './format';
import { updateNextClassWidget } from './native-widgets';
import type { NextClassProps } from '../../widgets/next-class-props';

type Copy = { label: string; empty: string };

const COPY: Record<string, Copy> = {
  ru: { label: 'Ближайшее занятие', empty: 'Запишись на занятие' },
  en: { label: 'Next class', empty: 'Book a class' },
  hy: { label: 'Մոտակա դաս', empty: 'Գրանցվիր դասի' },
};

function copyFor(locale: Locale): Copy {
  return COPY[locale] ?? COPY.en;
}

/** Ближайшая активная бронь, занятие которой ещё не началось. */
export function nextUpcomingBooking(bookings: ClientBooking[], now = Date.now()): ClientBooking | null {
  let next: ClientBooking | null = null;
  for (const booking of bookings) {
    // canCancelBooking проверяет именно «активна и не началась»: этого достаточно для выбора ближайшей.
    if (!canCancelBooking(booking, now)) continue;
    if (next === null || Date.parse(booking.startsAt) < Date.parse(next.startsAt)) next = booking;
  }
  return next;
}

export function nextClassProps(booking: ClientBooking | null, locale: Locale): NextClassProps {
  const copy = copyFor(locale);
  if (booking === null) {
    return { label: copy.label, title: '', when: '', short: '', empty: copy.empty };
  }
  return {
    label: copy.label,
    title: booking.classTitle ?? 'ArtDance',
    when: dateLabel(booking.startsAt, locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    short: dateLabel(booking.startsAt, locale, { hour: '2-digit', minute: '2-digit' }),
    empty: copy.empty,
  };
}

/** Синхронизирует виджет главного экрана со списком броней пользователя. */
export function syncNextClassWidget(bookings: ClientBooking[], locale: Locale): void {
  updateNextClassWidget(nextClassProps(nextUpcomingBooking(bookings), locale));
}
