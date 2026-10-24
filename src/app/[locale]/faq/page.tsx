/**
 * FAQ — вопросы и ответы.
 *
 * Единственная страница, где содержание почти целиком приходит из каталога
 * переводов, но числа в ответах — из бизнес-правил. Это принципиально: ответ «можно
 * отменить за 24 часа» обязан меняться вместе с `booking.freeCancellationHours`,
 * иначе поддержка отвечает одно, а страница обещает другое, и правым в споре
 * оказывается клиент.
 *
 * Ключи перечислены литералами, а не собраны из шаблона. Это длиннее, зато
 * компилятор проверяет каждый: вопрос, потерянный при переименовании, иначе
 * превращается в пустую строку в списке — и заметен только глазами.
 *
 * Разметка `FAQPage` выводится внутри `FaqAccordion` из того же массива, что и
 * список: расхождение схемы с видимым текстом Google трактует как обман.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import { FaqAccordion } from '@/components/content/faq-accordion';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildFaqGroups } from '@/server/content/faq';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.faq' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.faq(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function FaqPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('faq');
  const tHelp = await getTranslations('help');
  const tFooter = await getTranslations('footer');

  const groups = await buildFaqGroups(locale as Locale);

  const trail: Crumb[] = [{ name: tFooter('faq'), path: routes.faq() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection>
        <FaqAccordion groups={groups} />
      </ContentSection>

      <ContentSection tone="raised" spacing="tight" prose>
        <h2 className="text-heading-3">{tHelp('stillStuck.title')}</h2>
        <p className="text-body mt-3 text-content-secondary">{tHelp('stillStuck.body')}</p>
        <Button asChild className="mt-6">
          <Link href={routes.contact()}>{tHelp('stillStuck.cta')}</Link>
        </Button>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
