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
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

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

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('about');
  const tFooter = await getTranslations('footer');
  const format = await getFormatter();

  const values: ValueItem[] = [
    {
      id: 'trust',
      icon: ShieldCheckIcon,
      title: t('values.trust.title'),
      body: t('values.trust.body'),
    },
    { id: 'craft', icon: TagIcon, title: t('values.craft.title'), body: t('values.craft.body') },
    { id: 'local', icon: MapPinIcon, title: t('values.local.title'), body: t('values.local.body') },
    {
      id: 'openness',
      icon: HandshakeIcon,
      title: t('values.openness.title'),
      body: t('values.openness.body'),
    },
  ];

  const trail: Crumb[] = [{ name: tFooter('about'), path: routes.about() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        image={getContentHero('about')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection title={t('mission.title')} prose>
        <p className="text-body-lg text-content-secondary">{t('mission.body')}</p>
      </ContentSection>

      <ContentSection tone="raised" title={t('values.title')}>
        <ValueGrid items={values} columns={4} />
      </ContentSection>

      <ContentSection title={t('story.title')} prose>
        <p className="text-body-lg text-content-secondary">
          {/* Год без разделителя разрядов: формат `year`, иначе в ru получится «2 026». */}
          {t('story.body', { year: format.number(site.foundedYear, 'year') })}
        </p>
      </ContentSection>

      <ContentSection tone="cinema" align="center" title={t('cta.title')} subtitle={t('cta.subtitle')}>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.classes()}>{t('cta.primary')}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema">
            <Link href={routes.becomeInstructor()}>{t('cta.secondary')}</Link>
          </Button>
        </div>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
