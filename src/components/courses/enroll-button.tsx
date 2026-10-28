/**
 * ЗАПИСЬ НА КУРС.
 *
 * Запись — покупка: заказ (`COURSE_ENROLLMENT`) → провайдер → `settle`
 * создаёт `CourseEnrollment`. Кнопка не рисует «вы записаны»: запись появляется
 * только после подтверждения оплаты.
 *
 * Гость получает ссылку на вход. Это не недоделка: `CourseEnrollment` привязана
 * к `userId`, а прогресс — к записи, поэтому безымянного ученика не существует.
 */

'use client';

import { Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { useInAppPayment } from '@/components/payments/in-app-payment';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/routes';
import { paymentMethods } from '@/domain/enums';
import type { MessageKey } from '@/i18n/types';
import { Link, useRouter } from '@/i18n/routing';
import { toActionMessageKey } from '@/lib/payments/action-message';
import { createPaymentIntent } from '@/lib/payments/api';
import { enrollCourseAction } from '@/server/actions/courses';

interface EnrollButtonProps {
  courseId: string;
  courseTitle: string;
  signedIn: boolean;
}

export function EnrollButton({ courseId, courseTitle, signedIn }: EnrollButtonProps) {
  const t = useTranslations('courses');
  const tRoot = useTranslations();
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const { pay } = useInAppPayment();
  /* Заказ записи создаётся один раз: повтор после закрытия листа оплаты идёт по нему. */
  const pendingOrder = useRef<{ orderId: string; orderNumber: string } | null>(null);

  if (!signedIn) {
    return (
      <Button asChild variant="accent" block>
        <Link href={routes.signIn(routes.courses())} aria-label={`${t('enrollCta')} — ${tRoot('errors.unauthorized.title')}`}>
          {t('enrollCta')}
        </Link>
      </Button>
    );
  }

  const enroll = async () => {
    setPending(true);
    setError(null);
    try {
      let order = pendingOrder.current;
      if (!order) {
        const created = await enrollCourseAction({ courseId });
        if (created?.serverError) {
          setError(toActionMessageKey(created.serverError.messageKey));
          return;
        }
        if (!created?.data?.orderId) {
          setError('errors.generic.description');
          return;
        }
        order = { orderId: created.data.orderId, orderNumber: created.data.orderNumber };
        pendingOrder.current = order;
      }

      const { orderId, orderNumber } = order;
      const method = paymentMethods[0] ?? 'CARD';
      const outcome = await pay({
        method,
        start: () => createPaymentIntent({ orderId, method }),
        onComplete: () => router.push(routes.checkoutResult(orderNumber)),
      });
      if (!outcome.ok) setError(outcome.messageKey);
    } catch {
      setError('errors.generic.description');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="accent"
        block
        disabled={pending}
        aria-busy={pending}
        aria-label={`${t('enrollCta')} — ${courseTitle}`}
        onClick={() => void enroll()}
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
        {t('enrollCta')}
      </Button>
      {error ? (
        <p role="alert" className="text-caption font-semibold text-content-danger">
          {tRoot(error)}
        </p>
      ) : null}
    </div>
  );
}
