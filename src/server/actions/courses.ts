/**
 * ЗАПИСЬ НА КУРС.
 *
 * Заказ (`COURSE_ENROLLMENT`) → провайдер → `settle` создаёт `CourseEnrollment`.
 * Здесь только заказ: запись — результат оплаты, а не нажатия кнопки.
 *
 * Цена берётся из `Course.price` в базе, а не из запроса. Курс, снятый с
 * публикации между открытием страницы и нажатием, не покупается: `isPublished`
 * перепроверяется внутри действия, потому что страница могла быть открыта давно.
 */

'use server';

import { z } from 'zod';

import { domainErrors } from '@/domain/errors';
import { db } from '@/lib/db';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { createDirectOrder } from '@/server/orders/service';
import { authedAction } from '@/server/safe-action';

export const enrollCourseAction = authedAction
  .metadata({ rateLimit: 'paymentIntent', audit: 'course.enroll' })
  .inputSchema(z.object({ courseId: z.string().min(1).max(64) }))
  .action(async ({ parsedInput, ctx }) => {
    /* Курсы — раздел пресета: при выключенном модуле запись не принимается. */
    await assertEntitlementOrThrow('courses');

    const course = await db.course.findFirst({
      where: { id: parsedInput.courseId, isPublished: true, deletedAt: null },
      select: { id: true, slug: true, title: true, price: true },
    });
    if (!course) throw domainErrors.notFound();

    const caller = ctx.caller;

    /*
     * Уже записан — второй заказ не создаём. Это не оптимизация, а защита от
     * двойного списания: `CourseEnrollment` уникальна по паре, и второй заказ
     * доставкой всё равно не превратился бы во вторую запись, но деньги бы
     * списались.
     */
    const existing = await db.courseEnrollment.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: caller.id } },
      select: { id: true },
    });
    if (existing) throw domainErrors.duplicateEnrollment();

    /*
     * Название в заказе — заголовок курса, а не ключ перевода: `titleSnapshot`
     * читают счёт, письмо и админка, и курс к тому моменту может быть
     * переименован или снят. Снимок сохраняет то, что человек купил.
     */
    const order = await createDirectOrder({
      userId: caller.id,
      contact: { email: caller.email, phone: '', name: caller.name || caller.email },
      lines: [
        {
          type: 'COURSE_ENROLLMENT',
          title: course.title,
          unitPrice: course.price,
          metadata: { courseId: course.id, courseSlug: course.slug },
        },
      ],
    });

    return { orderId: order.id, orderNumber: order.orderNumber, total: order.total };
  });
