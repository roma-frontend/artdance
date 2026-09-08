import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { absoluteUrl, routes, seo, site } from '@/config';
import { PointerGlow } from '@/components/fx/pointer-glow';
import { ScrollProgress } from '@/components/fx/scroll-progress';
import { MobileDock } from '@/components/layout/mobile-dock';
import { SiteHeader } from '@/components/layout/site-header';
import { SkipToContent } from '@/components/layout/skip-to-content';
import { ThemeColorSync } from '@/components/layout/theme-color-sync';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { fontVariables } from '@/design/fonts';
import { SearchOverlayProvider } from '@/components/search/search-overlay';
import { JsonLdScript } from '@/components/seo/json-ld';
import { schemeTokens } from '@/design/tokens';
import { localeMeta, locales, isLocale, type Locale } from '@/i18n/config';
import { organizationSchema, websiteSchema } from '@/lib/seo/jsonld';
import { localeAlternates } from '@/lib/seo/sitemap';
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
      languages: localeAlternates(routes.home()),
    },
    openGraph: {
      type: 'website',
      siteName: seo.openGraph.siteName,
      locale: localeMeta[locale].bcp47,
      url: absoluteUrl(`/${locale}`),
      title: t('title'),
      description: t('description'),
      /*
       * Картинки здесь нет: её ставит файловое соглашение
       * (`opengraph-image.tsx` в каждом публичном сегменте). Объявленная в
       * метаданных, она ОТМЕНЯЕТ файловую — проверено на сборке, страница
       * занятия отдавала общую заглушку вместо своей карточки. Подробности — в
       * шапке `src/lib/seo/metadata.ts`.
       */
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
  const tBrand = await getTranslations({ locale: rawLocale, namespace: 'brand' });
  const brand = tBrand('name');

  return (
    <html
      lang={meta.bcp47}
      dir={meta.direction}
      data-scroll-behavior="smooth"
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
        {/*
          Organization и WebSite — схемы уровня сайта, поэтому они в layout, а не
          на каждой странице: повторять их в каждом документе значит трижды
          сообщить об одной организации. Схемы сущностей добавляют сами страницы.
        */}
        <JsonLdScript
          schema={[organizationSchema(rawLocale, brand), websiteSchema(rawLocale, brand)]}
        />

        <ThemeProvider>
          <ThemeColorSync />
          <NextIntlClientProvider>
            {/*
              Поиск оборачивает шапку и страницу: оверлей монтируется один раз на
              приложение (у него глобальное сочетание Cmd/Ctrl+K), а открывает его
              иконка в шапке — она `compact`, то есть остаётся видимой и на
              телефоне. Плитка «Поиск» в шторке разделов осталась обычной ссылкой
              на каталог: открывать диалог поверх закрывающейся шторки означало бы
              передавать фокус между двумя модальными слоями одновременно.
            */}
            <SearchOverlayProvider>
              <SkipToContent />
              <ScrollProgress />
              <PointerGlow />
              <SiteHeader />
              {children}
              <MobileDock />
              <ThemeToggle />
            </SearchOverlayProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
