/**
 * STATUS BADGE — единственное место, где статус превращается в цвет и текст.
 *
 * Это не удобство, а защита от конкретной болезни: как только статус красится по
 * месту, в проекте появляется пять разных наборов цветов для одного и того же
 * `CANCELLED` — в списке заказов, в карточке брони, в письме, в админке и в
 * выплатах. Дальше «почему у меня зелёная отмена, а у клиента красная» становится
 * вопросом на приёмке.
 *
 * **Пять словарей статусов, один компонент.** `BookingStatus`, `PaymentStatus`,
 * `OrderStatus`, `PayoutStatus`, `ModerationStatus` описывают разные сущности, но
 * отвечают на один вопрос — «в каком это состоянии». Разные компоненты означали бы
 * разные отступы и разные оттенки у одинаковых по смыслу состояний.
 *
 * **Карты полные по построению.** `satisfies Record<…>` делает пропущенное
 * значение ошибкой сборки: добавленный в схему статус нельзя забыть покрасить и
 * получить бесцветную метку на проде.
 *
 * **Текст — только из i18n.** Подпись приходит из `status.*` через функции
 * `domain/enums.ts`, и это те же строки, что видит человек в письме.
 *
 * **Цвет не единственный носитель смысла.** У метки всегда есть текст, поэтому
 * WCAG 1.4.1 выполнен без дополнительных иконок: «Отменено» читается и в
 * оттенках серого, и скринридером.
 */

import { useTranslations } from 'next-intl';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  bookingStatusLabelKey,
  moderationStatusLabelKey,
  orderStatusLabelKey,
  paymentStatusLabelKey,
  payoutStatusLabelKey,
  type BookingStatus,
  type ModerationStatus,
  type OrderStatus,
  type PaymentStatus,
  type PayoutStatus,
} from '@/domain/enums';
import type { MessageKey } from '@/i18n/types';

/** Роль цвета. Берётся из вариантов `Badge`, своих оттенков здесь нет. */
type Tone = NonNullable<BadgeProps['variant']>;

/**
 * Тон по смыслу состояния, а не по названию:
 *   • `success` — дошло до конца благополучно (оплачено, проведено, опубликовано);
 *   • `accent` — идёт по плану, действий не требует (подтверждено, в обработке);
 *   • `warning` — ждёт кого-то: клиента, модератора, платёжного провайдера;
 *   • `signal` — сорвалось и требует внимания (отказ, возврат, неявка);
 *   • `neutral` — закрыто без последствий или уже история.
 */
const bookingTones = {
  PENDING: 'warning',
  CONFIRMED: 'accent',
  COMPLETED: 'success',
  CANCELLED_BY_CUSTOMER: 'neutral',
  /* Отмена по инициативе исполнителя — сорванный план, а не штатный исход. */
  CANCELLED_BY_PROVIDER: 'signal',
  NO_SHOW: 'signal',
  RESCHEDULED: 'neutral',
  WAITLISTED: 'warning',
  EXPIRED: 'neutral',
} as const satisfies Record<BookingStatus, Tone>;

const paymentTones = {
  PENDING: 'warning',
  AUTHORIZED: 'accent',
  PAID: 'success',
  PARTIALLY_REFUNDED: 'warning',
  REFUNDED: 'neutral',
  FAILED: 'signal',
  CANCELLED: 'neutral',
  /* Chargeback — спор с банком: самое дорогое состояние во всей платформе. */
  CHARGEBACK: 'signal',
} as const satisfies Record<PaymentStatus, Tone>;

const orderTones = {
  CREATED: 'warning',
  PAID: 'accent',
  PACKING: 'accent',
  SHIPPED: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
  RETURNED: 'signal',
} as const satisfies Record<OrderStatus, Tone>;

const payoutTones = {
  SCHEDULED: 'warning',
  PROCESSING: 'accent',
  PAID: 'success',
  FAILED: 'signal',
  ON_HOLD: 'warning',
} as const satisfies Record<PayoutStatus, Tone>;

const moderationTones = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'signal',
} as const satisfies Record<ModerationStatus, Tone>;

/**
 * Вид статуса и его значение — дискриминированное объединение, а не два
 * независимых пропса. Иначе `kind="payout"` с `status="NO_SHOW"` компилируется, и
 * ошибку находит человек, а не сборка.
 */
export type StatusBadgeSubject =
  | { kind: 'booking'; status: BookingStatus }
  | { kind: 'payment'; status: PaymentStatus }
  | { kind: 'order'; status: OrderStatus }
  | { kind: 'payout'; status: PayoutStatus }
  | { kind: 'moderation'; status: ModerationStatus };

/** Тон и ключ подписи для любого статуса. Экспортируется для тестов и писем. */
export function statusPresentation(subject: StatusBadgeSubject): {
  tone: Tone;
  labelKey: MessageKey;
} {
  switch (subject.kind) {
    case 'booking':
      return { tone: bookingTones[subject.status], labelKey: bookingStatusLabelKey(subject.status) };
    case 'payment':
      return { tone: paymentTones[subject.status], labelKey: paymentStatusLabelKey(subject.status) };
    case 'order':
      return { tone: orderTones[subject.status], labelKey: orderStatusLabelKey(subject.status) };
    case 'payout':
      return { tone: payoutTones[subject.status], labelKey: payoutStatusLabelKey(subject.status) };
    case 'moderation':
      return {
        tone: moderationTones[subject.status],
        labelKey: moderationStatusLabelKey(subject.status),
      };
  }
}

type StatusBadgeProps = StatusBadgeSubject & {
  size?: BadgeProps['size'];
  className?: string;
};

export function StatusBadge({ size, className, ...subject }: StatusBadgeProps) {
  const t = useTranslations();
  const { tone, labelKey } = statusPresentation(subject);

  return (
    <Badge variant={tone} size={size} className={className}>
      {t(labelKey)}
    </Badge>
  );
}
