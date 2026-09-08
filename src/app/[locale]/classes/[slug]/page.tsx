/**
 * ЗАНЯТИЕ — детальная страница.
 *
 * Что решено осознанно.
 *
 * **Панель брони одна, а мест у неё два.** На широком экране это правая колонка,
 * закреплённая при прокрутке (`.detail-grid` делает `sticky` последнего
 * ребёнка); на узком — полоса снизу (`StickyActionBar`). Не две кнопки, а одна
 * в двух положениях: на каждой ширине видно ровно одну.
 *
 * **Условия отмены приходят из бизнес-правил, а не из текста.** «Бесплатная
 * отмена за 24 часа» — это `booking.freeCancellationHours`, и смена окна на 12
 * часов остаётся правкой одной строки конфигурации.
 *
 * **Заполненная группа не рекламируется.** При нулевом остатке кнопка меняется на
 * лист ожидания, а бейдж «в тренде» не показывается: то, что нельзя купить, не
 * продают.
 *
 * **Расписание собирается форматтером.** В данных день недели — число, время —
 * `HH:mm`; читаемый вид зависит от локали, и строка «Saturday, 18:00» из базы
 * означала бы английский день на армянской странице.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { ClassCard } from '@/components/catalog/class-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { StickyActionBar } from '@/components/layout/sticky-action-bar';
import { ReviewList } from '@/components/reviews/review-list';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { RatingStars } from '@/components/ui/rating-stars';
import { SpotsLeft } from '@/components/ui/spots-left';
import { booking, routes, site } from '@/config';
import { resolveMedia } from '@/domain/content';
import { danceStyleLabelKey, skillLevelLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { Link } from '@/i18n/routing';
import { dateForWeekday } from '@/lib/format/weekday';
import { breadcrumbSchema, courseSchema, type Crumb } from '@/lib/seo/jsonld';
import { getCatalogSlugs, getClassDetail } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Статическая генерация всех занятий.
 *
 * Страница занятия не содержит персональных данных, поэтому её можно собрать
 * заранее и отдавать из CDN. Доступность конкретных слотов на ней НЕ
 * показывается — за ней человек идёт на экран бронирования, который не
 * кешируется (`dataRevalidate.availability = 0`).
 */
export function generateStaticParams() {
  return getCatalogSlugs().classes.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = getClassDetail(slug);
  if (!item) return {};

  const t = await getTranslations({ locale: locale as Locale, namespace: 'classDetail' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.class(slug),
    title: item.title,
    description: item.description,
    openGraphType: 'article',
    keywords: [item.title, item.instructorName, item.venueName, t('aboutTitle')],
  });
}

export default async function ClassDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = getClassDetail(slug);
  if (!item) notFound();

  const t = await getTranslations('classDetail');
  /** Словарные подписи (направление, уровень) лежат в корне каталога переводов. */
  const tRoot = await getTranslations();
  const tCommon = await getTranslations('common');
  const tNav = await getTranslations('nav');
  const tBooking = await getTranslations('booking');
  const tReviews = await getTranslations('reviews');
  const format = await getFormatter({ locale: locale as Locale });

  const soldOut = item.spotsLeft <= 0;
  const bookHref = routes.instructorBooking(item.instructorSlug);
  const styleLabel = tRoot(danceStyleLabelKey(item.style as never));

  /** Один путь на страницу: и в крошках, и в структурированных данных. */
  const trail: Crumb[] = [
    { name: tNav('classes'), path: routes.classes() },
    { name: item.title, path: routes.class(item.slug) },
  ];

  /** Подпись действия: заполненная группа ведёт в лист ожидания, а не в оплату. */
  const actionLabel = soldOut
    ? tCommon('actions.joinWaitlist')
    : tCommon('actions.bookClass');

  return (
    <main id={site.mainContentId}>
      <JsonLdScript
        schema={[courseSchema(locale as Locale, item, styleLabel), breadcrumbSchema(locale as Locale, trail)]}
      />

      <PageHero
        title={item.title}
        eyebrow={styleLabel}
        image={item.image}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      >
        <div className="flex flex-wrap items-center gap-4">
          <Price amount={item.price} unit="perClass" emphasis="onCinema" />
          <SpotsLeft spots={item.spotsLeft} waitlistOpen={item.waitlistOpen} />
          {!soldOut && item.isTrending && (
            <Badge variant="onMedia">{t('trendingBadge')}</Badge>
          )}
        </div>
      </PageHero>

      <div className="page-container py-12 md:py-16">
        <div className="detail-grid">
          {/* ── Содержимое ── */}
          <div className="min-w-0">
            <ul className="mb-8 flex flex-wrap gap-2">
              <li>
                <Badge variant="accent" size="md">
                  {tRoot(skillLevelLabelKey(item.level as never))}
                </Badge>
              </li>
              <li>
                <Badge size="md">
                  {tCommon('units.minutes', { count: item.durationMinutes })}
                </Badge>
              </li>
              <li>
                <Badge size="md">{t('capacityNote', { count: item.capacity })}</Badge>
              </li>
            </ul>

            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('aboutTitle')}</h2>
              <p className="text-body-lg max-w-(--layout-content-max-width) text-content-secondary">
                {item.description}
              </p>
            </section>

            {item.learningPoints.length > 0 && (
              <section className="mb-12">
                <h2 className="text-heading-3 mb-4">{t('learnTitle')}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {item.learningPoints.map((point) => (
                    <li
                      key={point}
                      className="text-body flex items-start gap-3 rounded-md border border-border-default bg-surface-card px-4 py-3"
                    >
                      <span
                        aria-hidden
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Расписание ── */}
            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('scheduleTitle')}</h2>
              <ul className="divide-y divide-border-default rounded-lg border border-border-default bg-surface-card">
                {item.schedule.map((entry) => (
                  <li
                    key={`${entry.weekday}-${entry.startTime}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <span className="text-body font-semibold text-content-primary">
                      {format.dateTime(dateForWeekday(entry.weekday), 'weekdayLong')}
                    </span>
                    <span className="text-body text-content-secondary">
                      {tBooking('timeRange', { start: entry.startTime, end: entry.endTime })}
                    </span>
                    <SpotsLeft spots={entry.spotsLeft} waitlistOpen={item.waitlistOpen} />
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Инструктор ── */}
            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('instructorTitle')}</h2>

              <article className="card-surface relative flex flex-wrap items-center gap-5 rounded-lg border border-border-default bg-surface-card p-5 hover:shadow-md">
                <Media
                  {...resolveMedia(item.instructorImage, locale as Locale)}
                  preset="avatarLarge"
                  fallback="instructor"
                  className="size-20 shrink-0 rounded-full"
                />

                <div className="min-w-0 flex-1">
                  <h3 className="text-card-title">
                    <Link
                      href={routes.instructor(item.instructorSlug)}
                      className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                    >
                      {item.instructorName}
                    </Link>
                  </h3>
                  <p className="text-eyebrow mt-1.5 text-content-metal">
                    {item.instructorHeadline}
                  </p>
                  <div className="mt-2">
                    <RatingStars
                      rating={item.instructorRating}
                      count={item.instructorRatingCount}
                    />
                  </div>
                </div>

                {item.instructorVerified && (
                  <Badge variant="success" className="shrink-0">
                    {tCommon('labels.verified')}
                  </Badge>
                )}
              </article>
            </section>

            {/* ── Место ── */}
            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('locationTitle')}</h2>
              <p className="text-body text-content-secondary">
                <Link
                  href={routes.studio(item.venueSlug)}
                  className="font-semibold text-content-primary underline decoration-border-strong hover:text-content-accent"
                >
                  {item.venueName}
                </Link>
                {' · '}
                {item.venueDistrict}
              </p>
            </section>

            <ReviewList
              rating={item.rating}
              items={item.reviews}
              locale={locale as Locale}
              title={tReviews('title')}
              className="mb-12"
            />
          </div>

          {/* ── Панель брони: правая колонка, sticky из `.detail-grid` ── */}
          <aside>
            <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-md">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-eyebrow mb-2 text-content-tertiary">
                    {t('availabilityTitle')}
                  </p>
                  <Price amount={item.price} unit="perClass" emphasis="total" />
                </div>

                <FavoriteButton target="class" slug={item.slug} name={item.title} />
              </div>

              <dl className="text-body-sm mb-5 space-y-2 border-t border-border-default pt-5">
                <div className="flex justify-between gap-3">
                  <dt className="text-content-tertiary">{tCommon('labels.instructor')}</dt>
                  <dd className="text-end font-semibold">{item.instructorName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-content-tertiary">{tCommon('labels.studio')}</dt>
                  <dd className="text-end font-semibold">{item.venueName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-content-tertiary">{tCommon('labels.duration')}</dt>
                  <dd className="text-end font-semibold">
                    {tCommon('units.minutes', { count: item.durationMinutes })}
                  </dd>
                </div>
              </dl>

              <Button asChild block variant="accent" size="lg">
                <Link href={bookHref}>{actionLabel}</Link>
              </Button>

              {/* Заполненная группа объясняет, что будет дальше, а не молчит. */}
              {soldOut && item.waitlistOpen && (
                <p className="text-caption mt-4 text-content-secondary">{t('waitlistNote')}</p>
              )}

              <p className="text-caption mt-4 text-content-tertiary">
                {t('cancellationNote', {
                  hours: tCommon('units.hours', { count: booking.freeCancellationHours }),
                })}
              </p>
            </div>
          </aside>
        </div>

        {/* ── Похожие ── */}
        <section className="mt-16">
          <h2 className="text-heading-3 mb-6">{t('similarTitle')}</h2>

          {item.similar.length === 0 ? (
            <p className="text-body text-content-tertiary">{t('similarEmpty')}</p>
          ) : (
            <ul className="grid gap-5 xs:grid-cols-2 lg:grid-cols-3">
              {item.similar.map((similar) => (
                <li key={similar.slug}>
                  <CardTilt>
                    <ClassCard item={similar} locale={locale as Locale} />
                  </CardTilt>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Полоса действия для узкого экрана: правая колонка там уже под содержимым. */}
      <StickyActionBar
        summary={
          <>
            <Price amount={item.price} unit="perClass" emphasis="total" />
            <span className="text-caption block text-content-tertiary">
              {item.instructorName}
            </span>
          </>
        }
        action={
          <Button asChild variant="accent">
            <Link href={bookHref}>{actionLabel}</Link>
          </Button>
        }
      />

      <SiteFooter />
    </main>
  );
}
