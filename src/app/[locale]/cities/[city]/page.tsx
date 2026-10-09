/**
 * CITY — A-03: гео-хаб города.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { cityBySlug } from '@/domain/geo';

interface PageProps { params: Promise<{ locale: string; city: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, city } = await params;
  return buildMetadata({ locale: locale as Locale, path: routes.city(city), title: city });
}

export default async function CityPage({ params }: PageProps) {
  const { locale, city } = await params;
  setRequestLocale(locale as Locale);
  if (!cityBySlug(city)) notFound();
  const c = cityBySlug(city)!;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('citiesTitle')} — {city}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('cityCoordinates', { coords: `${c.center.lat}, ${c.center.lng}` })}{c.districts ? ` ${t('cityDistricts', { count: String(c.districts.length) })}` : ''}</p>
      {c.districts && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {c.districts.map((d) => (
            <li key={d.slug}><a href={`/${locale}${routes.district(city, d.slug)}`} className="rounded-full border border-border-default px-3 py-1 text-xs hover:bg-surface-sunken">{d.slug}</a></li>
          ))}
        </ul>
      )}
      <SiteFooter />
    </main>
  );
}
