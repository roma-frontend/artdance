/**
 * DISTRICT — A-03: гео-хаб района.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { cityBySlug, districtBySlug } from '@/domain/geo';

interface PageProps { params: Promise<{ locale: string; city: string; district: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, city, district } = await params;
  return buildMetadata({ locale: locale as Locale, path: routes.district(city, district), title: `${district} — ${city}` });
}

export default async function DistrictPage({ params }: PageProps) {
  const { locale, city, district } = await params;
  setRequestLocale(locale as Locale);
  if (!cityBySlug(city) || !districtBySlug(city as never, district)) notFound();
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{district} · {city}</h1>
      <p className="text-body mt-2 text-content-secondary">{(await getTranslations({ locale: locale as Locale, namespace: 'footer' }))('districtHint')}</p>
      <SiteFooter />
    </main>
  );
}
