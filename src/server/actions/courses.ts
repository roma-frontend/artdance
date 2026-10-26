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

import { createCourseEnrollmentOrder } from '@/server/courses/enroll';
import { authedAction } from '@/server/safe-action';

export const enrollCourseAction = authedAction
  .metadata({ rateLimit: 'paymentIntent', audit: 'course.enroll' })
  .inputSchema(z.object({ courseId: z.string().min(1).max(64) }))
  .action(async ({ parsedInput, ctx }) => {
    const order = await createCourseEnrollmentOrder(ctx.caller, { id: parsedInput.courseId });
    return { orderId: order.id, orderNumber: order.orderNumber, total: order.total };
  });
