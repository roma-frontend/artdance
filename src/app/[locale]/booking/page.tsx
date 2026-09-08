/**
 * ВХОД В БРОНИРОВАНИЕ — «с кем занимаемся?».
 *
 * Раздел «Calendar» в навигации (`routes.booking()`) ведёт сюда. Бронировать
 * можно только конкретное занятие у конкретного инструктора, поэтому первый шаг
 * — выбор инструктора, а сам выбор даты и времени живёт на
 * `/instructors/[slug]/book`.
 *
 * Карточка ведёт сразу к выбору времени, а не в профиль: у страницы одна задача,
 * и лишний переход между «посмотреть» и «забронировать» здесь только мешает.
 *
 * В список попадают только те, у кого есть занятие: ссылка обязана открываться.
 * Пустой список — состояние с объяснением, а не пустая сетка.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { InstructorCard } from '@/components/catalog/instructor-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import { getBookableInstructors } from '@/server/content/booking';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'booking' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.booking(),
    title: t('startTitle'),
    noIndex: true,
  });
}

export default async function BookingStartPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('booking');
  const tCommon = await getTranslations('common');
  const instructors = getBookableInstructors();

  return (
    <main id={site.mainContentId}>
      <div className="page-container inner-page">
        <h1 className="text-heading-2">{t('startTitle')}</h1>
        <p className="text-body mt-2 mb-8 text-content-secondary">{t('startSubtitle')}</p>

        {instructors.length === 0 ? (
          <EmptyState
            title={tCommon('states.empty')}
            description={t('noSlotsHint')}
            action={
              <Button asChild variant="outline">
                <Link href={routes.discover()}>{tCommon('actions.explore')}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-5 xs:grid-cols-2 lg:grid-cols-4">
            {instructors.map((item) => (
              <li key={item.slug}>
                <CardTilt>
                  <InstructorCard
                    item={item}
                    locale={locale as Locale}
                    href={routes.instructorBooking(item.slug)}
                  />
                </CardTilt>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
