/**
 * КУРС — детальная страница.
 *
 * Программа курса, условия, цена и запись. Два тумблера с разными ролями:
 *
 *   • `courses` — существует ли раздел вообще (страница, программа, превью);
 *   • `videoCourses` — доступны ли полные уроки.
 *
 * Поэтому страница доступна при включённом `courses` и показывает программу с
 * превью-уроками; ссылки на полные уроки помечены состоянием доступа и не ведут
 * в закрытую часть. `videoCourses` спрашивается здесь, а не только на странице
 * урока: иначе человек видел бы кликабельный список, который отдаёт 404.
 *
 * Запись на курс — покупка (`COURSE_ENROLLMENT`), как пакет и подписка; выдача
 * записи — в `settle` после подтверждения оплаты.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { EnrollButton } from '@/components/courses/enroll-button';
import { PageHero } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { getCaller } from '@/lib/auth/guards';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { routes, site } from '@/config';
import { resolveMedia } from '@/domain/content';
import { danceStyleLabelKey, skillLevelLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';
import { assertEntitlementOrNotFound } from '@/server/entitlements/guard';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';
import { getCourseDetail, getCourseSlugs } from '@/server/queries/courses';

interface PageProps { params: Promise<{ locale: string; slug: string }> }

/** Все опубликованные курсы известны заранее — собираем статически. */
export async function generateStaticParams() {
  return (await getCourseSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  /* Выключенный модуль курсов: заголовок и описание курса не попадают в выдачу. */
  const courseEnabled = (await getEffectiveEntitlementsSafe()).courses;
  const course = courseEnabled ? await getCourseDetail(slug, locale as Locale) : null;
  if (!course) return buildMetadata({ locale: locale as Locale, path: routes.course(slug), title: slug, noIndex: true });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.course(slug),
    title: course.title,
    description: course.description.slice(0, 180),
  });
}

export default async function CoursePage({ params }: PageProps) {
  await assertEntitlementOrNotFound('courses');

  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const [course, entitlements, caller] = await Promise.all([
    getCourseDetail(slug, locale as Locale),
    getEffectiveEntitlementsSafe(),
    getCaller(),
  ]);
  if (!course) notFound();

  const t = await getTranslations('courses');
  const tRoot = await getTranslations();
  const format = await getFormatter({ locale: locale as Locale });
  const videoEnabled = entitlements.videoCourses;

  const cover = course.cover ? resolveMedia(course.cover, locale as Locale) : null;
  const hours = Math.max(1, Math.round(course.totalMinutes / 60));

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={course.title}
        subtitle={course.description}
        eyebrow={tRoot(danceStyleLabelKey(course.style))}
        image={course.cover}
        locale={locale as Locale}
        breadcrumbs={[
          { label: tRoot('nav.courses'), href: routes.courses() },
          { label: course.title },
        ]}
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="accent">{tRoot(danceStyleLabelKey(course.style))}</Badge>
          <Badge variant="neutral">{tRoot(skillLevelLabelKey(course.level))}</Badge>
          <Badge variant="metal">{t('lessonsCount', { count: course.lessonsCount })}</Badge>
        </div>
      </PageHero>

      <div className="page-container detail-grid py-10 md:py-14">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="course-curriculum">
            <h2 id="course-curriculum" className="text-heading-3">{t('curriculumTitle')}</h2>
            <ol className="mt-4 flex flex-col gap-2">
              {course.lessons.map((lesson, index) => {
                /*
                 * Превью-урок открыт всем; остальные — только при включённых
                 * видеоуроках. Ссылка на закрытый урок не рисуется вовсе, чтобы
                 * не вести в 404, а строка программы остаётся: человек должен
                 * видеть, что получит.
                 */
                const open = lesson.isPreview || videoEnabled;
                const label = (
                  <span className="flex min-w-0 flex-1 items-baseline gap-3">
                    <span className="shrink-0 font-mono text-body-sm text-content-tertiary tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{lesson.title}</span>
                      <span className="text-caption text-content-tertiary">
                        {tRoot('common.units.minutes', { count: lesson.durationMinutes })}
                        {lesson.isPreview ? ` · ${t('enrolledBadge')}` : ''}
                      </span>
                    </span>
                  </span>
                );

                return (
                  <li key={lesson.id} className="rounded-lg border border-border-default bg-surface-card px-4 py-3">
                    {open ? (
                      <Link
                        href={routes.courseLesson(course.slug, lesson.slug)}
                        className="flex items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                      >
                        {label}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 text-content-secondary">{label}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {course.requirements.length > 0 && (
            <section aria-labelledby="course-requirements">
              <h2 id="course-requirements" className="text-heading-3">{t('requirementsTitle')}</h2>
              <ul className="mt-4 list-disc space-y-1.5 ps-5 text-body-sm text-content-secondary">
                {course.requirements.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
          {cover ? (
            <Media {...cover} preset="classCard" fallback="classCard" imageClassName="rounded-lg" />
          ) : null}
          <div>
            <p className="text-caption text-content-tertiary">{t('totalDuration', { duration: format.number(hours) })}</p>
            <Price amount={course.price} emphasis="total" className="mt-1" />
          </div>
          <p className="text-body-sm text-content-secondary">{t('lessonsCount', { count: course.lessonsCount })}</p>
          {/*
            Запись без аккаунта невозможна: `CourseEnrollment` привязана к
            `userId`, а покупка — к заказу. Кнопка ведёт на вход, а не
            создаёт заказ анонимно.
          */}
          <EnrollButton
            courseId={course.id}
            courseTitle={course.title}
            signedIn={Boolean(caller)}
          />
        </aside>
      </div>

      <SiteFooter />
    </main>
  );
}
