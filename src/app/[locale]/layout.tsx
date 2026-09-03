import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { absoluteUrl, seo, site } from '@/config';
import { PointerGlow } from '@/components/fx/pointer-glow';
import { ScrollProgress } from '@/components/fx/scroll-progress';
import { MobileDock } from '@/components/layout/mobile-dock';
import { SiteHeader } from '@/components/layout/site-header';
import { SkipToContent } from '@/components/layout/skip-to-content';
import { ThemeColorSync } from '@/components/layout/theme-color-sync';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { fontVariables } from '@/design/fonts';
import { schemeTokens } from '@/design/tokens';
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

/**
 * Цвет интерфейса браузера.
 *
 * На мобильных Safari и Chrome в этот цвет окрашиваются адресная строка и
 * область под ней. Без него светлая полоса остаётся над тёмным первым экраном и
 * читается как незагруженная часть страницы.
 *
 * Значения берутся из токенов, а не пишутся литералами, и их два: медиа-запрос
 * покрывает случай, когда пользователь ещё не выбирал тему вручную. После
 * явного выбора мету обновляет `ThemeColorSync` — медиа-запрос про наш
 * `data-theme` ничего не знает.
 */
export const viewport: Viewport = {
  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: schemeTokens.light.colors['surface-canvas'],
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: schemeTokens.dark.colors['surface-canvas'],
    },
  ],
};

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
      /*
       * `data-theme` здесь НЕ выставляется: значение зависит от выбора
       * пользователя (localStorage) или системной настройки, и сервер их не
       * знает. Атрибут ставит blocking-скрипт `next-themes` до первой отрисовки,
       * а до первого выбора тему определяет медиа-запрос в `tokens.css`.
       * `suppressHydrationWarning` нужен именно из-за этого атрибута.
       */
      suppressHydrationWarning
      className={fontVariables}
    >
      <body className="has-mobile-dock">
        <ThemeProvider>
          <ThemeColorSync />
          <NextIntlClientProvider>
            <SkipToContent />
            <ScrollProgress />
            <PointerGlow />
            <SiteHeader />
            {children}
            <MobileDock />
            <ThemeToggle />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
