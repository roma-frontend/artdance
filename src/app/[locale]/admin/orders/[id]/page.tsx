/**
 * ЗАКАЗ — карточка операции.
 *
 * Здесь администратор делает три вещи: понимает, что произошло (позиции, итоги,
 * платежи), двигает состояние и оформляет возврат. Править суммы нельзя, и это
 * не упущение: итоги посчитаны при оформлении, НДС зафиксирован в `vatRate`, и
 * ручная правка сделала бы отчётность недоказуемой.
 *
 * Предел возврата считается на сервере (оплачено минус уже возвращённое) и
 * передаётся в форму: доверять клиенту вычисление лимита нельзя, а показывать его
 * обязательно — иначе администратор узнаёт о лимите отказом.
 */

import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { RefundForm } from '@/components/admin/refund-form';
import { OrderStatusActions } from '@/components/admin/status-actions';
import { StatusBadge } from '@/components/data/status-badge';
import { AccessDenied } from '@/components/ui/access-denied';
import { routes } from '@/config';
import type { OrderStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { getOrderDetail } from '@/server/admin/operations';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** Разрешённые переходы. Тот же список, что проверяет действие на сервере. */
const transitions: Record<string, readonly OrderStatus[]> = {
  CREATED: ['PAID', 'CANCELLED'],
  PAID: ['PACKING', 'CANCELLED', 'RETURNED'],
  PACKING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export default async function AdminOrderPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('orders.view')) return <AccessDenied />;

  const order = await getOrderDetail(id);
  if (!order) notFound();

  const t = await getTranslations('admin.orders');
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  const paid = order.payments
    .filter((payment) => payment.status === 'PAID' || payment.status === 'PARTIALLY_REFUNDED')
    .reduce((sum, payment) => sum + payment.paidAmount, 0);

  return (
    <>
      <AdminPageHeader
        title={order.orderNumber}
        parent={{ href: routes.adminOrders(), labelKey: 'admin.orders.title' }}
        actions={<StatusBadge kind="order" status={order.status} size="md" />}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="order-items" className="lg:col-span-2">
          <h2 id="order-items" className="text-card-title mb-4 text-content-primary">
            {t('itemsSection')}
          </h2>

          <ul className="flex flex-col gap-3">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border-subtle bg-surface-card px-4 py-3"
              >
                <span className="text-body-sm text-content-primary">{item.titleSnapshot}</span>
                <span className="text-caption text-content-tertiary">
                  {tRoot(`admin.enums.lineItem.${item.type}`)}
                </span>
                <span className="text-body-sm text-content-secondary">
                  {format.number(item.quantity, 'plain')} × {format.number(item.unitPrice, 'price')}
                </span>
                <span className="text-price text-content-primary">
                  {format.number(item.lineTotal, 'price')}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="text-card-title mt-8 mb-4 text-content-primary">{t('totalsSection')}</h2>
          <dl className="flex flex-col gap-2">
            <Row labelKey="admin.fields.subtotal" value={format.number(order.subtotal, 'price')} t={tRoot} />
            <Row
              labelKey="admin.fields.discountTotal"
              value={format.number(order.discountTotal, 'price')}
              t={tRoot}
            />
            <Row
              labelKey="admin.fields.deliveryFee"
              value={format.number(order.deliveryFee, 'price')}
              t={tRoot}
            />
            <Row
              labelKey="admin.fields.vatAmount"
              value={`${format.number(order.vatAmount, 'price')} · ${format.number(Number(order.vatRate), 'percent')}`}
              t={tRoot}
            />
            <Row labelKey="admin.fields.total" value={format.number(order.total, 'price')} t={tRoot} />
          </dl>
        </section>

        <aside className="flex flex-col gap-8">
          <section aria-labelledby="order-status">
            <h2 id="order-status" className="text-card-title mb-4 text-content-primary">
              {t('statusSection')}
            </h2>
            {can('orders.fulfil') ? (
              <OrderStatusActions id={order.id} transitions={transitions[order.status] ?? []} />
            ) : null}
          </section>

          <section aria-labelledby="order-customer">
            <h2 id="order-customer" className="text-card-title mb-4 text-content-primary">
              {t('customerSection')}
            </h2>
            <dl className="flex flex-col gap-2">
              <Row labelKey="admin.fields.contactName" value={order.contactName} t={tRoot} />
              <Row labelKey="admin.fields.contactEmail" value={order.contactEmail} t={tRoot} />
              <Row labelKey="admin.fields.contactPhone" value={order.contactPhone} t={tRoot} />
              {order.deliveryMethod ? (
                <Row
                  labelKey="admin.fields.deliveryMethod"
                  value={tRoot(`admin.enums.deliveryMethod.${order.deliveryMethod}`)}
                  t={tRoot}
                />
              ) : null}
            </dl>
          </section>

          <section aria-labelledby="order-payments">
            <h2 id="order-payments" className="text-card-title mb-4 text-content-primary">
              {t('paymentSection')}
            </h2>

            {order.payments.length === 0 ? (
              <p className="text-body-sm text-content-tertiary">{t('noPayments')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3">
                    <StatusBadge kind="payment" status={payment.status} />
                    <span className="text-body-sm text-content-secondary">
                      {format.number(payment.paidAmount, 'price')}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {can('payments.refund') ? (
              <div className="mt-6">
                <h3 className="text-label mb-3 uppercase text-content-secondary">{t('refundTitle')}</h3>
                <RefundForm orderId={order.id} refundable={paid} />
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  );
}

/** Строка «подпись — значение». Вынесена, чтобы не повторять разметку двадцать раз. */
function Row({
  labelKey,
  value,
  t,
}: {
  labelKey: Parameters<Awaited<ReturnType<typeof getRootTranslate>>>[0];
  value: string;
  t: Awaited<ReturnType<typeof getRootTranslate>>;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2">
      <dt className="text-caption uppercase text-content-tertiary">{t(labelKey)}</dt>
      <dd className="text-body-sm text-content-primary">{value}</dd>
    </div>
  );
}
