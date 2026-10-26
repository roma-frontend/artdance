/**
 * ЗАПИСЬ НА КУРС — общая точка входа для веба (`enrollCourseAction`) и мобильного
 * приложения (`/api/courses/[slug]/enroll`).
 *
 * Заказ (`COURSE_ENROLLMENT`) → провайдер → `settle` создаёт `CourseEnrollment`.
 * Здесь только заказ: запись — результат оплаты, а не нажатия кнопки.
 *
 * Цена берётся из `Course.price` в базе, а не из запроса. Курс, снятый с
 * публикации между открытием страницы и нажатием, не покупается: `isPublished`
 * перепроверяется здесь, потому что страница могла быть открыта давно.
 *
 * Тумблер `courses` проверяется до любого чтения курса: выключенный модуль не
 * должен оставить в базе даже черновик заказа.
 */

import { domainErrors } from '@/domain/errors';
import { db } from '@/lib/db';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { createDirectOrder } from '@/server/orders/service';

export interface CourseBuyer {
  id: string;
  email: string;
  name: string;
}

/** Курс адресуется либо по `id` (веб-действие), либо по `slug` (мобильный маршрут). */
export type CourseRef = { id: string } | { slug: string };

export async function createCourseEnrollmentOrder(buyer: CourseBuyer, ref: CourseRef) {
  await assertEntitlementOrThrow('courses');

  const course = await db.course.findFirst({
    where: { ...ref, isPublished: true, deletedAt: null },
    select: { id: true, slug: true, title: true, price: true },
  });
  if (!course) throw domainErrors.notFound();

  /*
   * Уже записан — второй заказ не создаём, иначе человек заплатил бы дважды
   * за одну запись (`CourseEnrollment` уникальна по паре курс + пользователь).
   */
  const existing = await db.courseEnrollment.findUnique({
    where: { courseId_userId: { courseId: course.id, userId: buyer.id } },
    select: { id: true },
  });
  if (existing) throw domainErrors.duplicateEnrollment();

  /*
   * Название в заказе — заголовок курса, а не ключ перевода: `titleSnapshot`
   * читают счёт, письмо и админка, и курс к тому моменту может быть
   * переименован или снят. Снимок сохраняет то, что человек купил.
   */
  return createDirectOrder({
    userId: buyer.id,
    contact: { email: buyer.email, phone: '', name: buyer.name || buyer.email },
    lines: [
      {
        type: 'COURSE_ENROLLMENT',
        title: course.title,
        unitPrice: course.price,
        metadata: { courseId: course.id, courseSlug: course.slug },
      },
    ],
  });
}
