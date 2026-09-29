/**
 * FIRST BOOKING DISCOUNT (C-08) — промо только на первую бронь.
 * Проверка: Booking COUNT == 0 для userId; купон with appliesTo包含BOOKING скидка применяется одной транзакцией.
 */

export function isFirstBooking(bookingCount: number): boolean {
  return bookingCount === 0;
}

export function firstBookingDiscount(basePrice: number, percent: number): number {
  return Math.round((basePrice * percent) / 100);
}
