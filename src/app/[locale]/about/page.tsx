/**
 * ABOUT — о платформе.
 *
 * Страница отвечает на вопрос, который задаёт и клиент, и инструктор, и
 * потенциальный партнёр: почему это существует и можно ли этому доверять. Поэтому
 * здесь нет ни счётчиков, ни фотографий команды, которых у нас пока нет, — только
 * то, что правда: зачем платформа, чего она держится и что уже работает.
 *
 * Год основания приходит из `site`, а не из текста: «работаем с 2026» в трёх
 * переводах — это три места, где через год окажется неправда.
 */

import type { Metadata } from 'next';
import { HandshakeIcon, MapPinIcon, ShieldCheckIcon, TagIcon } from 'lucide-react';
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
import { buildAboutContent, type AboutValueId } from '@/server/content/about';
import { getContentHero } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.about' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.about(),
    title: t('title'),
    description: t('description'),
  });
}

const VALUE_ICONS = {
  trust: ShieldCheckIcon,
  craft: TagIcon,
  local: MapPinIcon,
  openness: HandshakeIcon,
} satisfies Record<AboutValueId, unknown>;

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const content = await buildAboutContent(locale as Locale);
  const tFooter = await getTranslations('footer');

  const values: ValueItem[] = content.values.items.map((value) => ({
    id: value.id,
    icon: VALUE_ICONS[value.id],
    title: value.title,
    body: value.body,
  }));

  const trail: Crumb[] = [{ name: tFooter('about'), path: routes.about() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={content.title}
        subtitle={content.subtitle}
        eyebrow={content.eyebrow}
        image={await getContentHero('about')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection title={content.mission.title} prose>
        <p className="text-body-lg text-content-secondary">{content.mission.body}</p>
      </ContentSection>

      <ContentSection tone="raised" title={content.values.title}>
        <ValueGrid items={values} columns={4} />
      </ContentSection>

      <ContentSection title={content.story.title} prose>
        <p className="text-body-lg text-content-secondary">{content.story.body}</p>
      </ContentSection>

      <ContentSection
        tone="cinema"
        align="center"
        title={content.cta.title}
        subtitle={content.cta.subtitle}
      >
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={content.cta.primaryPath}>{content.cta.primary}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema">
            <Link href={content.cta.secondaryPath}>{content.cta.secondary}</Link>
          </Button>
        </div>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
