/**
 * HELP — справочный центр.
 *
 * Не база знаний со своими статьями (это A-25 из бэклога, приоритет P2), а
 * маршрутизатор: шесть тем, каждая ведёт туда, где ответ действительно есть —
 * в раздел вопросов, в правовой документ или к живому человеку.
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
import { ValueGrid, type ValueItem } from '@/components/content/value-grid';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildHelpContent, type HelpTopicId } from '@/server/content/help';

interface PageProps {
  params: Promise<{ locale: string }>;
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

export default async function HelpPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const content = await buildHelpContent(locale as Locale);
  const tFooter = await getTranslations('footer');

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
