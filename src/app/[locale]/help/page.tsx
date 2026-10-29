/**
 * HELP — справочный центр.
 *
 * Не база знаний со своими статьями: отдельные статьи по темам (A-25) — решение
 * владельца контента, а не код. Здесь маршрутизатор: шесть тем, каждая ведёт
 * туда, где ответ действительно есть — в раздел вопросов, в правовой документ
 * или к живому человеку. Поиск по `?q=` ищет по тем же темам и вопросам FAQ и не
 * заводит собственных текстов.
 *
 * Так честнее, чем плодить страницы `/help/booking` с пересказом того же FAQ:
 * два места с одним ответом расходятся на первой же правке правил, а поисковик
 * получает две конкурирующие страницы про одно и то же.
 *
 * Ссылки на разделы FAQ используют якоря групп (`#booking`), которые
 * `FaqAccordion` ставит сам: тема справки открывает нужную группу вопросов, а не
 * начало длинной страницы.
 */

import type { Metadata } from 'next';
import {
  BookOpenIcon,
  CalendarCheckIcon,
  CreditCardIcon,
  ScaleIcon,
  TruckIcon,
  UserCogIcon,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import type { FaqGroup } from '@/components/content/faq-accordion';
import { ValueGrid, type ValueItem } from '@/components/content/value-grid';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { MIN_HELP_QUERY_LENGTH, searchHelp } from '@/lib/help/search';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildFaqGroups } from '@/server/content/faq';
import { buildHelpContent, type HelpTopicId } from '@/server/content/help';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.help' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.help(),
    title: t('title'),
    description: t('description'),
  });
}

const TOPIC_ICONS = {
  booking: CalendarCheckIcon,
  payments: CreditCardIcon,
  account: UserCogIcon,
  providers: BookOpenIcon,
  rules: ScaleIcon,
  shop: TruckIcon,
} satisfies Record<HelpTopicId, unknown>;

/** Вопросы всех групп одним списком: поиск ищет по записи, а ссылка ведёт на группу. */
function flattenFaq(groups: readonly FaqGroup[]) {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      groupId: group.id,
      question: item.question,
      answer: item.answer,
    })),
  );
}

export default async function HelpPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  /* `?q=` может прийти повторно: берём первое значение. */
  const { q } = await searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  const query = (raw ?? '').trim();

  const content = await buildHelpContent(locale as Locale);
  const tFooter = await getTranslations('footer');
  const t = await getTranslations('help');

  /* Короче порога поиск совпал бы почти со всем справочником, поэтому результатов нет. */
  const searched =
    query.length >= MIN_HELP_QUERY_LENGTH
      ? searchHelp(query, content.topics, flattenFaq(await buildFaqGroups(locale as Locale)))
      : null;

  const topics: ValueItem[] = content.topics.map((topic) => ({
    id: topic.id,
    icon: TOPIC_ICONS[topic.id],
    title: topic.title,
    body: topic.body,
    href: topic.anchor ? `${topic.path}#${topic.anchor}` : topic.path,
    linkLabel: topic.cta,
  }));

  const trail: Crumb[] = [{ name: tFooter('help'), path: routes.help() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={content.title}
        subtitle={content.subtitle}
        eyebrow={content.eyebrow}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection spacing="tight">
        <form role="search" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-label text-content-secondary">{t('search.label')}</span>
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t('search.placeholder')}
              minLength={MIN_HELP_QUERY_LENGTH}
              className="mt-2"
            />
          </label>
          <Button type="submit">{t('search.submit')}</Button>
        </form>
        <p className="text-body mt-2 text-content-secondary">{t('search.hint')}</p>

        {searched ? (
          <div className="mt-8 grid gap-8">
            {searched.topics.length === 0 && searched.faq.length === 0 ? (
              <p className="text-body text-content-secondary">{t('search.empty')}</p>
            ) : null}

            {searched.topics.length > 0 ? (
              <section aria-labelledby="help-search-topics">
                <h2 id="help-search-topics" className="text-heading-3">
                  {t('search.topicsTitle')}
                </h2>
                <ul className="mt-3 grid gap-2">
                  {searched.topics.map((topic) => (
                    <li key={topic.id}>
                      <Link
                        href={topic.anchor ? `${topic.path}#${topic.anchor}` : topic.path}
                        className="text-body underline-offset-4 hover:underline"
                      >
                        {topic.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {searched.faq.length > 0 ? (
              <section aria-labelledby="help-search-faq">
                <h2 id="help-search-faq" className="text-heading-3">
                  {t('search.faqTitle')}
                </h2>
                <ul className="mt-3 grid gap-2">
                  {searched.faq.map((entry) => (
                    <li key={`${entry.groupId}-${entry.question}`}>
                      <Link
                        href={`${routes.faq()}#${entry.groupId}`}
                        className="text-body underline-offset-4 hover:underline"
                      >
                        {entry.question}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </ContentSection>

      <ContentSection>
        <ValueGrid items={topics} columns={3} />
      </ContentSection>

      <ContentSection tone="raised" spacing="tight" prose>
        <h2 className="text-heading-3">{content.stillStuck.title}</h2>
        <p className="text-body mt-3 text-content-secondary">{content.stillStuck.body}</p>
        <Button asChild className="mt-6">
          <Link href={content.stillStuck.path}>{content.stillStuck.cta}</Link>
        </Button>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
