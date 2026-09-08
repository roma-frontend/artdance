/**
 * ИНСТРУКТОР — профиль.
 *
 * Что решено осознанно.
 *
 * **Аватар наезжает на обложку.** Портрет работает дважды: приглушённым кадром
 * в баннере и резким кружком поверх его нижней границы. Второго снимка у
 * инструктора нет, а два разных изображения ради «правильной» вёрстки означали
 * бы, что профиль нельзя завести, не заказав фотосессию.
 *
 * **Годы выводятся форматом `year`, а не как обычное число.** `format.number(2019)`
 * в русской локали даёт «2 019»: в биографии это читается как опечатка. Формат
 * объявлен в `i18n/config.ts` — здесь только его имя.
 *
 * **«Преподаёт в» — ссылки, а не перечисление.** Название зала без перехода на
 * его страницу — тупик: человек читает, где занятия, и ничего не может с этим
 * сделать.
 *
 * **Ничего не обещаем за данные.** Нет опыта в профиле — раздела нет, а не
 * пустой заголовок «Опыт». Нет групповых занятий — об этом сказано словами
 * (`instructor.classesEmpty`), потому что частные занятия у инструктора всё
 * равно доступны, и пустая сетка выглядела бы как сбой загрузки.
 *
 * **Ближайшего времени на странице нет.** `instructor.quickBookNext` намеренно не
 * используется: страница статическая и живёт в CDN, а «ближайшее: сб, 18:00»,
 * посчитанное в момент сборки, через неделю станет неправдой. Конкретные слоты
 * показывает экран бронирования — он `force-dynamic`.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheckIcon } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { ClassCard } from '@/components/catalog/class-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { StickyActionBar } from '@/components/layout/sticky-action-bar';
import { ReviewList } from '@/components/reviews/review-list';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { RatingStars } from '@/components/ui/rating-stars';
import { booking, routes, site } from '@/config';
import { resolveMedia } from '@/domain/content';
import { danceStyleLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbSchema, personSchema, type Crumb } from '@/lib/seo/jsonld';
import { Link } from '@/i18n/routing';
import { getCatalogSlugs, getInstructorDetail } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Профиль собирается заранее: персональных данных на нём нет, а состав занятий
 * меняется реже, чем его читают. Доступность слотов здесь не показывается —
 * за ней человек идёт на экран бронирования.
 */
export async function generateStaticParams() {
  return (await getCatalogSlugs()).instructors.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await getInstructorDetail(slug);
  if (!item) return {};

  return buildMetadata({
    locale: locale as Locale,
    path: routes.instructor(slug),
    title: `${item.name} — ${item.headline}`,
    description: item.bio,
    openGraphType: 'profile',
    keywords: [item.name, ...item.specializations],
  });
}

export default async function InstructorProfilePage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = await getInstructorDetail(slug);
  if (!item) notFound();

  const t = await getTranslations('instructor');
  /** Словарные подписи направлений лежат в корне каталога переводов. */
  const tRoot = await getTranslations();
  const tCommon = await getTranslations('common');
  const tNav = await getTranslations('nav');
  const format = await getFormatter({ locale: locale as Locale });

  const bookHref = routes.instructorBooking(item.slug);
  /**
   * «Есть занятия на этой неделе» — утверждение о данных, а не украшение:
   * занятие в каталоге повторяется каждую неделю, поэтому свободное место в
   * расписании означает свободное место и на этой неделе.
   */
  const hasOpenClasses = item.classes.some((entry) => entry.spotsLeft > 0);

  /** Один путь на страницу: и в крошках, и в структурированных данных. */
  const trail: Crumb[] = [
    { name: tNav('instructors'), path: routes.instructors() },
    { name: item.name, path: routes.instructor(item.slug) },
  ];

  return (
    <main id={site.mainContentId}>
      <JsonLdScript
        schema={[personSchema(locale as Locale, item), breadcrumbSchema(locale as Locale, trail)]}
      />

      <PageHero
        title={item.name}
        eyebrow={item.headline}
        image={item.image}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <div className="page-container">
        {/*
          Полоса с аватаром поднята на половину его высоты: кружок стоит на
          границе обложки и содержимого. `z-10` — потому что баннер объявляет
          собственный контекст наложения, и без него портрет уйдёт под него.
        */}
        <div className="relative z-10 -mt-11.25 flex flex-wrap items-end gap-x-6 gap-y-4 pb-10">
          <div className="relative shrink-0">
            <Media
              {...resolveMedia(item.image, locale as Locale)}
              preset="avatarLarge"
              fallback="instructor"
              className="size-22.5 rounded-full ring-3 ring-surface-card"
            />

            {/*
              В прототипе это зелёный круг с галочкой без подписи (`.inst-v`):
              для скринридера — картинка ни о чём. Подпись обязательна.
            */}
            {item.isVerified && (
              <span
                title={t('verifiedBadge')}
                className="absolute -end-0.5 bottom-0.5 grid size-7 place-items-center rounded-full bg-success text-content-on-accent ring-3 ring-surface-card"
              >
                <BadgeCheckIcon aria-hidden className="size-4" />
                <span className="sr-only">{t('verifiedBadge')}</span>
              </span>
            )}
          </div>

          <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <dt className="text-caption text-content-tertiary">{tCommon('labels.rating')}</dt>
              <dd className="mt-1">
                <RatingStars rating={item.ratingAverage} count={item.ratingCount} size="md" />
              </dd>
            </div>

            <div>
              <dt className="text-caption text-content-tertiary">{tCommon('labels.students')}</dt>
              <dd className="text-body mt-1 font-semibold text-content-primary">
                {t('statsStudents', { count: item.studentCount })}
              </dd>
            </div>

            <div>
              <dt className="text-caption text-content-tertiary">{tCommon('labels.experience')}</dt>
              <dd className="text-body mt-1 font-semibold text-content-primary">
                {tCommon('units.yearsExperience', { count: item.yearsExperience })}
              </dd>
            </div>
          </dl>

          <FavoriteButton
            target="instructor"
            slug={item.slug}
            name={item.name}
            className="ms-auto"
          />
        </div>

        <div className="detail-grid pb-12 md:pb-16">
          {/* ── Содержимое ── */}
          <div className="min-w-0">
            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('aboutTitle', { name: item.name })}</h2>
              <p className="text-body-lg max-w-(--layout-prose-max-width) text-content-secondary">
                {item.bio}
              </p>
            </section>

            {/* ── Направления: метка — это фильтр каталога, а не наклейка ── */}
            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('stylesTitle')}</h2>
              <ul className="flex flex-wrap gap-2">
                {item.styles.map((style) => (
                  <li key={style}>
                    <Link
                      href={routes.classes({ style })}
                      className={badgeVariants({ variant: 'accent', size: 'md' })}
                    >
                      {tRoot(danceStyleLabelKey(style as never))}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {item.specializations.length > 0 && (
              <section className="mb-12">
                <h2 className="text-heading-3 mb-4">{t('specializationsTitle')}</h2>
                {/*
                  Специализации не кликаются: фильтра по ним в каталоге нет, и
                  метка-ссылка в никуда хуже метки.
                */}
                <ul className="flex flex-wrap gap-2">
                  {item.specializations.map((specialization) => (
                    <li key={specialization}>
                      <Badge size="md">{specialization}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Опыт: раздела нет, если опыта в данных нет ── */}
            {item.experience.length > 0 && (
              <section className="mb-12">
                <h2 className="text-heading-3 mb-4">{t('experienceTitle')}</h2>
                <ol className="relative space-y-6 ps-6 before:absolute before:inset-y-2 before:start-1 before:w-px before:bg-border-default before:content-['']">
                  {item.experience.map((entry) => (
                    <li key={`${entry.title}-${entry.startYear}`} className="relative">
                      {/* Точка накрывает линию собственной обводкой цвета фона. */}
                      <span
                        aria-hidden
                        className="absolute top-2 -start-6 size-2 rounded-full bg-accent ring-3 ring-surface-canvas"
                      />

                      <p className="text-body font-semibold text-content-primary">{entry.title}</p>

                      {entry.organization !== undefined && (
                        <p className="text-body-sm text-content-secondary">{entry.organization}</p>
                      )}

                      <p className="text-caption mt-1 text-content-tertiary">
                        {t('experienceRange', {
                          from: format.number(entry.startYear, 'year'),
                          to:
                            entry.endYear === undefined
                              ? t('experiencePresent')
                              : format.number(entry.endYear, 'year'),
                        })}
                        {entry.location !== undefined && ` · ${entry.location}`}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {item.venues.length > 0 && (
              <section className="mb-12">
                <h2 className="text-heading-3 mb-4">{t('venuesTitle')}</h2>
                <ul className="flex flex-wrap gap-2">
                  {item.venues.map((venue) => (
                    <li key={venue.slug}>
                      <Link
                        href={routes.studio(venue.slug)}
                        className="text-body inline-flex items-center rounded-md border border-border-default bg-surface-card px-4 py-2 text-content-primary hover:border-border-strong hover:text-content-accent"
                      >
                        {venue.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Групповые занятия ── */}
            <section className="mb-12">
              <h2 className="text-heading-3 mb-6">{t('classesTitle')}</h2>

              {item.classes.length === 0 ? (
                <p
                  role="status"
                  className="text-body rounded-lg border border-dashed border-border-default bg-surface-raised px-6 py-10 text-center text-content-secondary"
                >
                  {t('classesEmpty')}
                  <span className="text-body-sm mt-1 block text-content-tertiary">
                    {t('privateSessionsTitle')}
                  </span>
                </p>
              ) : (
                <ul className="grid gap-5 xs:grid-cols-2">
                  {item.classes.map((entry) => (
                    <li key={entry.slug}>
                      <CardTilt>
                        <ClassCard item={entry} locale={locale as Locale} />
                      </CardTilt>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <ReviewList
              rating={item.rating}
              items={item.reviews}
              locale={locale as Locale}
              title={t('reviewsTitle')}
            />
          </div>

          {/* ── Панель записи: правая колонка, sticky из `.detail-grid` ── */}
          <aside>
            <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-md">
              <p className="text-eyebrow mb-2 text-content-tertiary">{t('bookPanelTitle')}</p>
              <Price amount={item.hourlyRateFrom} unit="perHour" from emphasis="total" />

              <dl className="text-body-sm mt-5 space-y-3 border-t border-border-default pt-5">
                {item.venues[0] !== undefined && (
                  <div>
                    <dt className="text-content-tertiary">{tCommon('labels.location')}</dt>
                    <dd className="mt-0.5 font-semibold text-content-primary">
                      {t('locationNote', { studio: item.venues[0].name })}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-content-tertiary">{t('availabilityTitle')}</dt>
                  <dd className="mt-0.5 font-semibold text-content-primary">
                    {/*
                      Выезд — не «дополнительная услуга в описании», а радиус из
                      бизнес-правил: расширение зоны не должно требовать правки
                      текста на трёх языках.
                    */}
                    {item.acceptsTravel
                      ? t('travelAvailable', {
                          radius: tCommon('units.kilometers', {
                            value: booking.travelRadiusKm,
                          }),
                        })
                      : t('travelUnavailable')}
                  </dd>
                </div>
              </dl>

              <Button asChild block variant="accent" size="lg" className="mt-6">
                <Link href={bookHref}>{tCommon('actions.bookSession')}</Link>
              </Button>

              {hasOpenClasses && (
                <p className="text-caption mt-4 text-content-secondary">{t('availabilityNote')}</p>
              )}

              <p className="text-caption mt-2 text-content-tertiary">
                {tRoot('classDetail.cancellationNote', {
                  hours: tCommon('units.hours', { count: booking.freeCancellationHours }),
                })}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <StickyActionBar
        summary={
          <>
            <Price amount={item.hourlyRateFrom} unit="perHour" from emphasis="total" />
            <span className="text-caption block text-content-tertiary">{item.headline}</span>
          </>
        }
        action={
          <Button asChild variant="accent">
            <Link href={bookHref}>{tCommon('actions.book')}</Link>
          </Button>
        }
      />

      <SiteFooter />
    </main>
  );
}
