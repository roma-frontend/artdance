/**
 * ANALYTICS — реестр событий воронки.
 * Событие — ключ из реестра, а не строка в компоненте.
 * Покрывает 07 §6 `src/config/analytics.ts` для A-16, C-04.
 */

export const analyticsEvents = [
  'search.performed',
  'catalog.viewed',
  'class.viewed',
  'slot.selected',
  'booking.created',
  'booking.cancelled',
  'booking.completed',
  'checkout.started',
  'checkout.completed',
  'cart.abandoned',
  'cart.recovered',
  'promo.applied',
  'review.submitted',
  'favorite.toggled',
  'pass.purchased',
  'referral.claimed',
  'boost.started',
  'wallet.topup',
] as const;

export type AnalyticsEvent = (typeof analyticsEvents)[number];

export function isAnalyticsEvent(value: string): value is AnalyticsEvent {
  return (analyticsEvents as readonly string[]).includes(value);
}
