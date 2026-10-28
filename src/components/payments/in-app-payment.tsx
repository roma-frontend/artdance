'use client';

import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type { PaymentMethod } from '@/domain/enums';
import { formatMoney, money } from '@/domain/money';
import type { MessageKey } from '@/i18n/types';
import { type PaymentApiResult, type PaymentAttempt, reconcilePaymentRequest } from '@/lib/payments/api';
import { type PaymentFlow, paymentFlow } from '@/lib/payments/in-app-flow';

import { type RetryResult, TestCardForm } from './test-card-form';

/** Stripe.js грузится только тогда, когда пользователь реально открыл оплату картой через Stripe. */
const StripePaymentForm = dynamic(
  () => import('./stripe-payment-form').then((module) => module.StripePaymentForm),
  { ssr: false, loading: () => <SheetLoading /> },
);

export interface PayRequest {
  /** Способ, который выбрал покупатель. От него зависит, нужна ли оплата прямо сейчас. */
  method: PaymentMethod;
  /**
   * Создаёт попытку оплаты. Заказ здесь не создаём: вызывающий код создаёт его один раз и
   * передаёт сюда только запрос попытки, чтобы повтор не плодил заказы.
   */
  start: () => Promise<PaymentApiResult<PaymentAttempt>>;
  /** Оплата прошла или не требуется: можно переходить к результату. */
  onComplete: () => void;
}

export type PayOutcome = { ok: true } | { ok: false; messageKey: MessageKey };

type SheetFlow = Extract<PaymentFlow, { kind: 'test-card' | 'stripe' }>;

interface Sheet {
  /** Меняется при каждом открытии, чтобы форма начиналась с чистого состояния. */
  id: number;
  flow: SheetFlow;
  paymentId: string;
  amount: number;
  method: PaymentMethod;
  start: PayRequest['start'];
  onComplete: () => void;
}

interface InAppPaymentValue {
  pay: (request: PayRequest) => Promise<PayOutcome>;
}

const InAppPaymentContext = createContext<InAppPaymentValue | null>(null);

/**
 * Встроенная оплата: лист поверх страницы, без перехода на сторонний сайт. Лист открывается
 * только для потоков, где нужен ввод платёжных данных. Оплата подтверждается на сервере,
 * а клиент лишь переходит к результату, который читается из базы.
 */
export function InAppPaymentProvider({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const sequence = useRef(0);

  const pay = useCallback(async (request: PayRequest): Promise<PayOutcome> => {
    const result = await request.start();
    if (!result.ok) return { ok: false, messageKey: result.error.messageKey };

    const flow = paymentFlow(result.data, request.method);
    if (flow.kind === 'done') {
      request.onComplete();
      return { ok: true };
    }
    if (flow.kind === 'unavailable') return { ok: false, messageKey: 'paymentSheet.unavailable' };

    sequence.current += 1;
    setSheet({
      id: sequence.current,
      flow,
      paymentId: result.data.paymentId,
      amount: result.data.amount,
      method: request.method,
      start: request.start,
      onComplete: request.onComplete,
    });
    return { ok: true };
  }, []);

  const value = useMemo<InAppPaymentValue>(() => ({ pay }), [pay]);

  /*
   * Обработчики берутся из того рендера, где лист был открыт. Поэтому `sheet` в них актуален и
   * тогда, когда пользователь закрыл лист во время запроса: ответ сервера всё равно доходит до
   * `onComplete`, и покупатель не остаётся на странице без результата.
   */
  async function handlePaid() {
    if (!sheet) return;
    setSheet(null);
    if (sheet.flow.kind === 'stripe') await reconcilePaymentRequest(sheet.paymentId);
    sheet.onComplete();
  }

  async function retryAttempt(): Promise<RetryResult> {
    if (!sheet) return { ok: false, messageKey: 'paymentSheet.notCompleted' };

    const result = await sheet.start();
    if (!result.ok) return { ok: false, messageKey: result.error.messageKey };

    const flow = paymentFlow(result.data, sheet.method);
    if (flow.kind !== 'test-card') return { ok: false, messageKey: 'paymentSheet.unavailable' };

    setSheet((current) => (current ? { ...current, flow, paymentId: result.data.paymentId } : current));
    return { ok: true, providerTransactionId: flow.providerTransactionId };
  }

  const totalLabel = sheet ? formatMoney(money(sheet.amount), locale) : '';

  function handleOpenChange(open: boolean) {
    if (!open) setSheet(null);
  }

  return (
    <InAppPaymentContext.Provider value={value}>
      {children}
      <Dialog open={sheet !== null} onOpenChange={handleOpenChange}>
        {sheet && (
          <DialogContent closeLabel={t('common.actions.close')} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('paymentSheet.title')}</DialogTitle>
              <DialogDescription>{t('paymentSheet.description', { amount: totalLabel })}</DialogDescription>
            </DialogHeader>

            {sheet.flow.kind === 'test-card' ? (
              <TestCardForm
                key={sheet.id}
                providerTransactionId={sheet.flow.providerTransactionId}
                totalLabel={totalLabel}
                retry={retryAttempt}
                onPaid={handlePaid}
              />
            ) : (
              <StripePaymentForm
                key={sheet.id}
                publishableKey={sheet.flow.publishableKey}
                clientSecret={sheet.flow.clientSecret}
                locale={locale}
                totalLabel={totalLabel}
                onPaid={handlePaid}
              />
            )}
          </DialogContent>
        )}
      </Dialog>
    </InAppPaymentContext.Provider>
  );
}

/** Хук для кнопок оплаты. Вне провайдера падает сразу, а не молча открывает ничего. */
export function useInAppPayment(): InAppPaymentValue {
  const context = useContext(InAppPaymentContext);
  if (!context) throw new Error('useInAppPayment must be used inside InAppPaymentProvider');
  return context;
}

function SheetLoading() {
  const t = useTranslations();
  return (
    <div className="flex justify-center py-8">
      <Spinner label={t('paymentSheet.loading')} />
    </div>
  );
}
