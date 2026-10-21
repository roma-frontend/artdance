/**
 * СВЕРКА НА СТРАНИЦЕ ВОЗВРАТА.
 *
 * Провайдер редиректит клиента раньше, чем успевает доехать webhook, поэтому
 * страница `/checkout/result/:orderNumber`, открытая сразу после оплаты, ещё
 * может видеть `PENDING`. Ждать webhook нельзя: человек смотрит на экран
 * прямо сейчас.
 *
 * Компонент просит сервер сверить платёж один раз и перерисовывает страницу,
 * если статус изменился. Именно «один раз»: сверка — это вызов провайдера, и
 * цикл «пока PENDING — сверять» превратил бы открытую вкладку в генератор
 * запросов к эквайреру.
 *
 * Рендерить нечего: это действие, а не экран. Поэтому `null` — и в разметке
 * страницы компонент не занимает места.
 */

'use client';

import { useEffect, useRef } from 'react';

import { useRouter } from '@/i18n/routing';
import { reconcilePaymentRequest } from '@/lib/payments/api';

interface ResultReconcileProps {
  paymentId: string;
  /** Статус, который страница уже показала. Совпал — перерисовка не нужна. */
  status: string;
}

export function ResultReconcile({ paymentId, status }: ResultReconcileProps) {
  const router = useRouter();
  /* StrictMode вызывает эффект дважды в разработке — второй запрос бессмыслен. */
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    /* Подтверждён и финальный — спрашивать некого. */
    if (status !== 'PENDING' && status !== 'AUTHORIZED') return;

    let cancelled = false;
    void reconcilePaymentRequest(paymentId).then((result) => {
      if (cancelled || !result.ok) return;
      if (result.data.status !== status) router.refresh();
    });

    return () => {
      cancelled = true;
    };
  }, [paymentId, status, router]);

  return null;
}
