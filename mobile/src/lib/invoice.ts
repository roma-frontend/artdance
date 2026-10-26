import { catalogFor } from '@/i18n/catalog';

import { dateLabel, price } from './format';
import type { Locale } from './i18n';
import { orderStatusLabel, paymentStatusLabel, type ClientOrderDetail } from './orders';

/** Текстовый счёт по заказу для отправки через системное окно. Сумма и позиции — из ответа сервера. */
export function buildInvoiceText(order: ClientOrderDetail, locale: Locale): string {
  const c = catalogFor(locale);
  const lines: string[] = [
    c.footer.orderInvoiceTitle.replace('{number}', order.orderNumber),
    dateLabel(order.placedAt, locale, { day: '2-digit', month: 'short', year: 'numeric' }),
    orderStatusLabel(order.status, c),
    '',
    `${c.account.orders.itemsTitle}:`,
    ...order.items.map((item) => {
      const name = item.quantity > 1 ? `${item.title} × ${item.quantity}` : item.title;
      return `- ${name}: ${price(item.lineTotal, locale)}`;
    }),
    '',
    `${c.common.labels.subtotal}: ${price(order.subtotal, locale)}`,
    ...(order.discountTotal > 0 ? [`${c.common.labels.discount}: -${price(order.discountTotal, locale)}`] : []),
    ...(order.deliveryFee > 0 ? [`${c.common.labels.delivery}: ${price(order.deliveryFee, locale)}`] : []),
    `${c.common.labels.total}: ${price(order.total, locale)}`,
  ];
  if (order.payments.length > 0) {
    lines.push('', `${c.account.orders.paymentTitle}:`);
    for (const payment of order.payments) {
      lines.push(`- ${paymentStatusLabel(payment.status, c)}: ${price(payment.amount, locale)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
