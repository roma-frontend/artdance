/**
 * DISCOVER — вход в каталог и результаты поиска.
 *
 * Раздел отличается от `/classes` не оформлением, а вопросом, на который
 * отвечает. `/classes` — «покажи занятия и дай их отфильтровать». `/discover` —
 * «я не знаю, что мне нужно» или «я ввёл запрос»: сюда ведут поисковая строка
 * первого экрана, иконка поиска в шапке (как фоллбэк без JavaScript) и главная
 * кнопка «Book Now». Поэтому здесь ищется всё сразу — занятия, инструкторы,
 * залы, события, товары — а не одна сущность с фильтрами.
 *
 * Два состояния экрана:
 *
 *   • **без запроса** — направления плиткой и подборки: страница отвечает на
 *     «что тут вообще есть», и пустая сетка результатов на ней была бы ответом
 *     «ничего»;
 *   • **с запросом** — результаты, сгруппированные по разделам, со счётчиками и
 *     переключателем раздела.
 *
 * Переключатель разделов — ссылки, а не табы с состоянием: `?scope=studios`
 * обязан открываться по прямому адресу, как и любой другой фильтр каталога.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { ClassCard } from '@/components/catalog/class-card';
import { ClassCarousel } from '@/components/catalog/class-carousel';
import { InstructorCard } from '@/components/catalog/instructor-card';
import { StyleTileGrid } from '@/components/catalog/style-tile-grid';
import { VenueCard } from '@/components/catalog/venue-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { Reveal } from '@/components/fx/reveal';
import { HeroSearchBar } from '@/components/home/hero-search-bar';
import { PageHero } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { SectionHeading } from '@/components/ui/section-heading';
import { SkeletonCardGrid } from '@/components/ui/skeleton-card';
import { limits, routes, site } from '@/config';
import { parseCatalogQuery, type RawSearchParams } from '@/domain/catalog';
import { danceStyles } from '@/domain/enums';
import {
  enabledSearchScopes,
  parseSearchScope,
  searchScopeLabelKey,
  type SearchHit,
  type SearchScope,
} from '@/domain/search';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { buildMetadata } from '@/lib/seo/metadata';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import {
  getClassList,
  getInstructorList,
  getListingHero,
  getVenueList,
  searchCatalog,
} from '@/server/content/catalog';
import { getHomeContent } from '@/server/content/home';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.discover' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.discover(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function DiscoverPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const raw = await searchParams;
  const query = parseCatalogQuery(raw);
  const scope = parseSearchScope(raw.scope);

  const t = await getTranslations('catalog');
  const tNav = await getTranslations('nav');
  const tRoot = await getRootTranslate();

  const term = query.q ?? '';
  const hasQuery = term.length >= limits.search.minQueryLength;

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('discover.title')}
        subtitle={t('discover.subtitle')}
        eyebrow={tNav('discover')}
        image={getListingHero('discover')}
        locale={locale as Locale}
        breadcrumbs={[{ label: tNav('discover') }]}
      >
        {/* Строка поиска — та же, что на первом экране: один вход в один параметр URL. */}
        <HeroSearchBar initialQuery={term} className="px-0" />
      </PageHero>

      {/*
        Баннер отдаётся сразу, результаты — потоком. `loading.tsx` здесь был бы
        грубее: он заменяет скелетом весь экран, включая шапку раздела и строку
        поиска, которые готовы мгновенно и от запроса не зависят.
      */}
      <Suspense
        fallback={
          <div className="page-container py-12 md:py-16">
            <SkeletonCardGrid label={tRoot('a11y.loading')} />
          </div>
        }
      >
        {hasQuery ? (
          <SearchResults term={term} scope={scope} />
        ) : (
          <ExploreSections locale={locale as Locale} />
        )}
      </Suspense>

      <SiteFooter />
    </main>
  );
}

/* ─────────────────────────── Состояние с запросом ─────────────────────────── */

async function SearchResults({
  term,
  scope,
}: {
  term: string;
  scope: SearchScope;
}) {
  const t = await getTranslations('search');
  const tRoot = await getTranslations();
  const tCommon = await getTranslations('common');

  /**
   * Счётчики считаются по всем разделам, а не по выбранному: переключатель
   * обязан показывать, сколько найдено в каждом, иначе выбор раздела — это
   * прыжок в неизвестность.
   */
  const all = searchCatalog(term, 'all', limits.search.maxResults);
  const visible = scope === 'all' ? all : all.filter((hit) => hit.scope === scope);

  const countFor = (candidate: SearchScope): number =>
    candidate === 'all' ? all.length : all.filter((hit) => hit.scope === candidate).length;

  return (
    <div className="page-container py-12 md:py-16">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-heading-3">{t('resultsTitle')}</h2>
        <p className="text-body-sm text-content-secondary" aria-live="polite">
          {tCommon('counts.results', { count: visible.length })}
        </p>
      </div>

      {/* Переключатель разделов: ссылки, потому что раздел — часть адреса. */}
      <ul className="mb-10 flex flex-wrap gap-2">
        {enabledSearchScopes().map((candidate) => {
          const count = countFor(candidate);
          const active = candidate === scope;

          return (
            <li key={candidate}>
              <Link
                href={routes.discover({
                  q: term,
                  ...(candidate === 'all' ? {} : { scope: candidate }),
                })}
                aria-current={active ? 'page' : undefined}
                aria-disabled={count === 0 ? true : undefined}
                className={cn(
                  'text-2xs inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-semibold',
                  'transition-colors duration-200 ease-brand',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
                  active
                    ? 'bg-accent text-content-on-accent'
                    : 'bg-surface-sunken text-content-secondary hover:bg-accent-soft hover:text-content-accent',
                  /* Пустой раздел не прячем: его отсутствие в списке читалось бы как ошибка. */
                  count === 0 && !active && 'opacity-50',
                )}
              >
                {tRoot(searchScopeLabelKey(candidate))}
                <span className="text-2xs opacity-70">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 ? (
        <EmptyState
          title={t('noResults', { query: term })}
          description={t('noResultsHint')}
          action={
            <Button asChild variant="outline">
              <Link href={routes.classes()}>{tCommon('actions.explore')}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((hit) => (
            <li key={hit.id}>
              <SearchResultRow hit={hit} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Строка результата.
 *
 * Одна разметка на все разделы намеренно: смешанный список из карточек разной
 * высоты и формы читается как сбой вёрстки, а не как разнообразие. Раздел
 * различает подпись-бейдж, а не геометрия.
 */
async function SearchResultRow({ hit }: { hit: SearchHit }) {
  const t = await getTranslations();

  return (
    <article
      className={cn(
        'card-surface group relative flex items-center gap-4 rounded-lg p-3',
        'border border-border-default bg-surface-card',
        'hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md',
      )}
    >
      <Media
        src={hit.image}
        alt=""
        preset="thumbnail"
        fallback="classCard"
        className="size-16 shrink-0 rounded-md"
      />

      <div className="min-w-0 flex-1">
        <Badge size="sm" className="mb-1.5">
          {t(searchScopeLabelKey(hit.scope))}
        </Badge>

        <h3 className="text-body truncate font-semibold">
          <Link
            href={hit.href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {hit.title}
          </Link>
        </h3>

        <p className="text-caption truncate text-content-tertiary">{hit.subtitle}</p>
      </div>

      {hit.price !== undefined && (
        <div className="shrink-0 text-end">
          <Price amount={hit.price} />
        </div>
      )}
    </article>
  );
}

/* ─────────────────────────── Состояние без запроса ─────────────────────────── */

/**
 * Экран исследования.
 *
 * Не пустая сетка с фильтрами, а ответ на вопрос «что тут есть»: направления
 * плиткой, затем занятия лентой, затем инструкторы и залы. Каждый блок ведёт в
 * свой полный листинг — здесь витрина, а не каталог.
 */
async function ExploreSections({ locale }: { locale: Locale }) {
  const t = await getTranslations('catalog');
  const tHome = await getTranslations('home');
  const tCommon = await getTranslations('common');

  const home = getHomeContent();
  const defaults = { sort: 'relevance', page: 1, pageSize: 8 } as const;

  const classes = await getClassList({ ...defaults });
  const instructors = await getInstructorList({ ...defaults, pageSize: 4 });
  const venues = await getVenueList({ ...defaults, pageSize: 3 });

  return (
    <>
      <section className="section-y-tight">
        <div className="page-container">
          <Reveal className="mb-10">
            <SectionHeading
              align="center"
              eyebrow={tHome('discover.eyebrow')}
              title={tHome('discover.title')}
              subtitle={tHome('discover.subtitle', { styles: danceStyles.length })}
              className="mb-0"
            />
          </Reveal>

          <StyleTileGrid tiles={home.styleTiles} locale={locale} />
        </div>
      </section>

      <section className="section-y-tight bg-surface-raised">
        <div className="page-container">
          <Reveal variant="left" className="mb-8">
            <SectionHeading
              eyebrow={tHome('popular.eyebrow')}
              title={t('classes.title')}
              subtitle={t('classes.subtitle')}
              className="mb-0"
            />
          </Reveal>

          <Reveal variant="right">
            <ClassCarousel label={t('classes.title')}>
              {classes.items.map((item) => (
                <li key={item.slug} className="max-w-75 shrink-0 grow basis-65 snap-start">
                  <CardTilt>
                    <ClassCard item={item} locale={locale} />
                  </CardTilt>
                </li>
              ))}
            </ClassCarousel>
          </Reveal>

          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href={routes.classes()}>{tCommon('actions.viewAll')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="section-y-tight">
        <div className="page-container">
          <Reveal className="mb-10">
            <SectionHeading
              eyebrow={tHome('instructors.eyebrow')}
              title={t('instructors.title')}
              subtitle={t('instructors.subtitle')}
              className="mb-0"
            />
          </Reveal>

          <Reveal as="ul" variant="stagger" className="grid gap-5 xs:grid-cols-2 lg:grid-cols-4">
            {instructors.items.map((item) => (
              <li key={item.slug}>
                <CardTilt>
                  <InstructorCard item={item} locale={locale} />
                </CardTilt>
              </li>
            ))}
          </Reveal>

          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href={routes.instructors()}>{tCommon('actions.viewAll')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="section-y-tight bg-surface-raised">
        <div className="page-container">
          <Reveal className="mb-10">
            <SectionHeading
              eyebrow={tHome('studios.eyebrow')}
              title={t('studios.title')}
              subtitle={t('studios.subtitle')}
              className="mb-0"
            />
          </Reveal>

          <Reveal as="ul" variant="stagger" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {venues.items.map((item) => (
              <li key={item.slug}>
                <CardTilt>
                  <VenueCard item={item} locale={locale} />
                </CardTilt>
              </li>
            ))}
          </Reveal>

          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href={routes.studios()}>{tCommon('actions.viewAll')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
