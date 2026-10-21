/**
 * КУРСЫ — каталог.
 *
 * Раздел был заглушкой «скоро», хотя таблицы курсов, уроков и записей на курс
 * существовали с самого начала. Теперь это настоящий каталог: опубликованные
 * курсы из базы, фильтры по направлению и уровню, цена и длительность.
 *
 * **Тумблер `courses` решает, существует ли раздел.** 404, а не пустая сетка:
 * страница, которую поисковик проиндексировал до выключения модуля, обязана
 * исчезнуть, а не показывать «ничего не найдено».
 *
 * **`videoCourses` здесь не нужен.** Курс — это программа и превью-уроки;
 * воспроизведение полных уроков — отдельный модуль (`courses/[slug]/[lesson]`)
 * и отдельный тумблер. Каталог курсов без видео остаётся каталогом.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CourseCard } from '@/components/catalog/course-card';
import { PageHero } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import type { DanceStyle, SkillLevel } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';
import { assertEntitlementOrNotFound } from '@/server/entitlements/guard';
import { getCourseList } from '@/server/queries/courses';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'courses' });
  return buildMetadata({
    locale: locale as Locale,
    path: routes.courses(),
    title: t('title'),
    description: t('subtitle'),
  });
}

/** Один параметр из `searchParams`, где значение может быть массивом. */
function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CoursesPage({ params, searchParams }: PageProps) {
  await assertEntitlementOrNotFound('courses');

  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const sp = await searchParams;
  const pageParam = Number.parseInt(param(sp.page) ?? '1', 10) || 1;
  const style = param(sp.style) as DanceStyle | undefined;
  const level = param(sp.level) as SkillLevel | undefined;

  const result = await getCourseList(
    { page: pageParam, ...(style ? { style } : {}), ...(level ? { level } : {}) },
    locale as Locale,
  );

  const t = await getTranslations('courses');
  const tNav = await getTranslations('nav');
  const tCommon = await getTranslations('common');

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={tNav('courses')}
        locale={locale as Locale}
        breadcrumbs={[{ label: tNav('courses') }]}
      />

      <section className="page-container py-10 md:py-14">
        {result.items.length === 0 ? (
          <EmptyState
            title={tCommon('states.empty')}
            action={
              <Button asChild variant="accent">
                <Link href={routes.classes()}>{tCommon('actions.explore')}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {result.items.map((item) => (
              <li key={item.slug}>
                <CourseCard item={item} locale={locale as Locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
