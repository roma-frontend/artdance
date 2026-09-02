import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { absoluteUrl, seo, site } from '@/config';
import { PointerGlow } from '@/components/fx/pointer-glow';
import { ScrollProgress } from '@/components/fx/scroll-progress';
import { SiteHeader } from '@/components/layout/site-header';
import { SkipToContent } from '@/components/layout/skip-to-content';
import { fontVariables } from '@/design/fonts';
import { localeMeta, locales, isLocale, type Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';

import '@/styles/globals.css';

/** Статическая генерация всех локалей — SSG вместо SSR на каждый запрос. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/** Сегмент URL → типизированная локаль. Неизвестное значение отдаём в 404. */
function resolveLocale(value: string): Locale {
  return isLocale(value) ? value : routing.defaultLocale;
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'seo.home' });
  const tBrand = await getTranslations({ locale, namespace: 'brand' });

  const brand = tBrand('name');

  return {
    metadataBase: new URL(site.url),
    title: {
      default: `${t('title')} — ${brand}`,
      template: seo.titleTemplate.replace('{brand}', brand),
    },
    description: t('description'),
    applicationName: brand,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries([
        ...locales.map((l) => [localeMeta[l].bcp47, `/${l}`]),
        ['x-default', `/${seo.hreflang.xDefault}`],
      ]),
    },
    openGraph: {
      type: 'website',
      siteName: seo.openGraph.siteName,
      locale: localeMeta[locale].bcp47,
      url: absoluteUrl(`/${locale}`),
      title: t('title'),
      description: t('description'),
      images: [
        {
          url: seo.openGraph.defaultImage,
          width: seo.openGraph.imageWidth,
          height: seo.openGraph.imageHeight,
        },
      ],
    },
    twitter: {
      card: seo.twitter.card,
      site: seo.twitter.site,
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();

  /** Позволяет использовать i18n в статически отрендеренных серверных компонентах. */
  setRequestLocale(rawLocale);

  const meta = localeMeta[rawLocale];

  return (
    <html
      lang={meta.bcp47}
      dir={meta.direction}
      data-theme="light"
      suppressHydrationWarning
      className={fontVariables}
    >
      <body>
        <NextIntlClientProvider>
          <SkipToContent />
          <ScrollProgress />
          <PointerGlow />
          <SiteHeader />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
