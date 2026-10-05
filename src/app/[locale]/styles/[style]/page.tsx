/**
 * ХАБ НАПРАВЛЕНИЯ — `/styles/hip-hop`.
 *
 * Зачем страница существует (A-01 в бэклоге): человек ищет «уроки бачаты в
 * Ереване», а не «каталог занятий». Восемнадцать направлений × три локали — это
 * пятьдесят четыре документа под конкретные запросы, и органика остаётся самым
 * дешёвым каналом привлечения: она не требует бюджета на рекламу.
 *
 * Чем отличается от `/classes?style=bachata`, если данные те же. Каталог отвечает
 * «вот занятия, подходящие под фильтры» — это ответ для того, кто уже выбрал. Хаб
 * отвечает «что это за танец, кому подойдёт, кто ведёт, где и сколько стоит» — для
 * того, кто выбирает. Отсюда состав: сначала описание направления, потом
 * предложение, и только затем ссылка в каталог с уже поставленным фильтром.
 *
 * Три решения, которые стоит знать.
 *
 * **Страница есть у всех восемнадцати направлений, а в индекс попадают не все.**
 * Слаг направления — часть словаря предметной области, и `/styles/flamenco`
 * обязан отвечать содержимым, а не 404: описание фламенко правдиво независимо от
 * того, ведёт ли его кто-нибудь сегодня. Но приглашать поисковик на «уроки
 * фламенко в Ереване», которых нет, значит обещать несуществующее и получить
 * отказ на первом переходе — поэтому хаб без предложения закрыт от индексации, и
 * это следует из данных (`getStyleHubSlugs`), а не из списка в коде: появился
 * преподаватель — страница вошла в индекс сама.
 *
 * **Пустое состояние здесь не заглушка, а содержание.** «Занятий пока нет» —
 * законный ответ, и он ведёт дальше: к соседним направлениям и к приглашению
 * преподавать. Тупик вместо этого — самый частый способ потерять человека,
 * пришедшего по редкому запросу.
 *
 * **Счётчики считает контент-слой по данным.** «48 занятий» над одной карточкой
 * — не украшение, а ошибка; см. шапку блока «Направления» в
 * `server/content/catalog.ts`.
 */

import { GraduationCapIcon, SparklesIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ClassCard } from '@/components/catalog/class-card';
import { InstructorCard } from '@/components/catalog/instructor-card';
import { StyleLinkList } from '@/components/catalog/style-link-list';
import { VenueCard } from '@/components/catalog/venue-card';
import { ContentSection } from '@/components/content/content-section';
import { CardTilt } from '@/components/fx/card-tilt';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Price } from '@/components/ui/price';
import { routes, site } from '@/config';
import {
  danceStyleAboutKey,
  danceStyleGearKey,
  danceStyleLabelKey,
  danceStyleLedeKey,
  danceStyleSlug,
  danceStyles,
  skillLevelLabelKey,
  type DanceStyle,
} from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { breadcrumbSchema, type Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { getStyleHub, getStyleHubSlugs } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string; style: string }>;
}

/**
 * Статическая генерация ВСЕХ направлений, а не только тех, что в карте сайта.
 *
 * Разные вопросы: `generateStaticParams` отвечает «какие адреса существуют»,
 * `getStyleHubSlugs` — «какие из них стоит предлагать поисковику». Собрать
 * заранее можно всё: персональных данных на странице нет, а восемнадцать
 * статических документов на локаль дешевле одного вызова функции на каждый
 * переход.
 */
export async function generateStaticParams() {
  return danceStyles.map((style) => ({ style: danceStyleSlug(style) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, style: slug } = await params;
  const hub = await getStyleHub(slug);
  if (!hub) return {};

  const t = await getTranslations({ locale: locale as Locale });
  const style = hub.style as DanceStyle;
  const styleLabel = t(danceStyleLabelKey(style));

  return buildMetadata({
    locale: locale as Locale,
    path: routes.style(hub.slug),
    title: t('styleHub.title', { style: styleLabel }),
    /* Описание — собственный текст направления, а не шаблон с подставленным именем. */
    description: t(danceStyleLedeKey(style)),
    keywords: [styleLabel, t('nav.classes'), t('nav.instructors')],
    /*
     * Направление без предложения из индекса исключено, но остаётся доступным по
     * адресу и по внутренним ссылкам.
     */
    noIndex: !(await getStyleHubSlugs()).includes(hub.slug),
  });
}

export default async function StyleHubPage({ params }: PageProps) {
  const { locale, style: slug } = await params;
  setRequestLocale(locale as Locale);

  const hub = await getStyleHub(slug);
  if (!hub) notFound();

  const style = hub.style as DanceStyle;

  const t = await getTranslations('styleHub');
  /** Словарные подписи (направление, уровень) лежат в корне каталога переводов. */
  const tRoot = await getTranslations();
  const tCommon = await getTranslations('common');
  const tNav = await getTranslations('nav');
  const tFooter = await getTranslations('footer');

  const styleLabel = tRoot(danceStyleLabelKey(style));

  const trail: Crumb[] = [
    { name: tNav('styles'), path: routes.styles() },
    { name: styleLabel, path: routes.style(hub.slug) },
  ];

  return (
    <main id={site.mainContentId}>
      <JsonLdScript schema={breadcrumbSchema(locale as Locale, trail)} />

      <PageHero
        title={t('title', { style: styleLabel })}
        subtitle={tRoot(danceStyleLedeKey(style))}
        eyebrow={t('eyebrow')}
        image={hub.image}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      >
        {/*
          Сводка первого экрана: только то, что есть в данных. Отсутствующий
          показатель не превращается в «0 занятий» — он не показывается вовсе,
          иначе первый экран сообщает о пустоте вместо того, чтобы рассказать о
          танце.
        */}
        <ul className="flex flex-wrap items-center gap-3">
          {hub.classCount > 0 && (
            <li>
              <Badge variant="onMedia" size="md">
                {tCommon('counts.classes', { count: hub.classCount })}
              </Badge>
            </li>
          )}
          {hub.instructorCount > 0 && (
            <li>
              <Badge variant="onMedia" size="md">
                {tCommon('counts.instructors', { count: hub.instructorCount })}
              </Badge>
            </li>
          )}
          {hub.levels.map((level) => (
            <li key={level}>
              <Badge variant="onMedia" size="md">
                {tRoot(skillLevelLabelKey(level as never))}
              </Badge>
            </li>
          ))}
          {hub.priceFrom !== null && (
            <li>
              <Price amount={hub.priceFrom} from unit="perClass" emphasis="onCinema" />
            </li>
          )}
        </ul>
      </PageHero>

      {/* ── О направлении: собственный текст, из-за которого страница существует ── */}
      <ContentSection title={t('aboutTitle', { style: styleLabel })} prose>
        <p className="text-body-lg text-content-secondary">{tRoot(danceStyleAboutKey(style))}</p>

        <div className="mt-8 rounded-lg border border-border-default bg-surface-raised p-5">
          <h3 className="text-card-title mb-2 flex items-center gap-2">
            <SparklesIcon aria-hidden className="size-4 text-content-accent" />
            {t('gearTitle')}
          </h3>
          <p className="text-body-sm text-content-secondary">{tRoot(danceStyleGearKey(style))}</p>
        </div>
      </ContentSection>

      {/* ── Занятия ── */}
      <ContentSection tone="raised" title={t('classesTitle', { style: styleLabel })}>
        {hub.classes.length === 0 ? (
          <EmptyState
            icon={<GraduationCapIcon aria-hidden className="size-8" />}
            title={t('classesEmptyTitle', { style: styleLabel })}
            description={t('classesEmptyBody', { style: styleLabel })}
            action={
              <Button asChild variant="accent">
                <Link href={routes.becomeInstructor()}>{tFooter('becomeInstructor')}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className="grid gap-5 xs:grid-cols-2 lg:grid-cols-3">
              {hub.classes.map((item) => (
                <li key={item.slug}>
                  <CardTilt>
                    <ClassCard item={item} locale={locale as Locale} />
                  </CardTilt>
                </li>
              ))}
            </ul>

            {/*
              Ссылка в каталог с уже поставленным фильтром: хаб показывает первые
              карточки, полный список — работа листинга, у которого есть фильтры,
              сортировка и пагинация.
            */}
            <div className="mt-8">
              <Button asChild variant="outline">
                <Link href={routes.classes({ style: hub.slug })}>
                  {t('classesAll', { style: styleLabel })}
                </Link>
              </Button>
            </div>
          </>
        )}
      </ContentSection>

      {/* ── Преподаватели ── */}
      <ContentSection title={t('instructorsTitle', { style: styleLabel })}>
        {hub.instructors.length === 0 ? (
          <EmptyState
            title={t('instructorsEmptyTitle', { style: styleLabel })}
            description={t('instructorsEmptyBody', { style: styleLabel })}
            action={
              <Button asChild variant="accent">
                <Link href={routes.becomeInstructor()}>{tFooter('becomeInstructor')}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className="grid gap-5 xs:grid-cols-2 lg:grid-cols-3">
              {hub.instructors.map((item) => (
                <li key={item.slug}>
                  <CardTilt>
                    <InstructorCard item={item} locale={locale as Locale} />
                  </CardTilt>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Button asChild variant="outline">
                <Link href={routes.instructors({ style: hub.slug })}>
                  {t('instructorsAll', { style: styleLabel })}
                </Link>
              </Button>
            </div>
          </>
        )}
      </ContentSection>

      {/*
        Залы показываются только когда есть занятия: у зала своего направления
        нет, связь идёт через них. Пустой блок «где учат» под пустым блоком
        «занятия» повторил бы одну и ту же новость дважды.
      */}
      {hub.venues.length > 0 && (
        <ContentSection
          tone="raised"
          title={t('studiosTitle', { style: styleLabel })}
          subtitle={hub.districts.join(' · ')}
        >
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {hub.venues.map((item) => (
              <li key={item.slug}>
                <CardTilt>
                  <VenueCard item={item} locale={locale as Locale} />
                </CardTilt>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Button asChild variant="outline">
              <Link href={routes.studios({ style: hub.slug })}>{t('studiosAll')}</Link>
            </Button>
          </div>
        </ContentSection>
      )}

      {/* ── Соседние направления: выход со страницы, а не тупик ── */}
      <ContentSection
        title={t('relatedTitle', { style: styleLabel })}
        subtitle={t('relatedSubtitle', { style: styleLabel })}
      >
        <StyleLinkList items={hub.related} columns={3} />
      </ContentSection>

      <ContentSection
        tone="cinema"
        align="center"
        title={t('cta.title', { style: styleLabel })}
        subtitle={t('cta.subtitle')}
      >
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.classes({ style: hub.slug })}>{t('cta.primary')}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema">
            <Link href={routes.instructors({ style: hub.slug })}>{t('cta.secondary')}</Link>
          </Button>
        </div>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
