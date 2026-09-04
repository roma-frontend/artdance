/**
 * `/checkout` без шага → первый шаг.
 *
 * Ссылка «Оформить» из корзины ведёт на `routes.checkout()`, а состояние
 * оформления живёт в URL шага. Перенаправление, а не рендер первого шага по этому
 * адресу: иначе у одного и того же экрана два адреса, и «назад» из второго шага
 * приводит на страницу-двойника.
 *
 * `redirect` берётся из `@/i18n/routing`, а не из `next/navigation`: иначе
 * теряется префикс локали.
 */

import { routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function CheckoutIndexPage({ params }: PageProps) {
  const { locale } = await params;
  redirect({ href: routes.checkoutStep('contact'), locale: locale as Locale });
}
