import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { cities } from '@/domain/geo';
import { Link } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.cities(), title: t('citiesTitle'), description: t('citiesTitle') });
}

export default async function CitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('citiesTitle')}</h1>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {cities.map((c) => (
          <li key={c.slug} className="rounded-xl border border-border-default bg-surface-card p-5">
            <h2 className="text-card-title"><Link href={routes.city(c.slug)} className="hover:underline">{c.slug}</Link></h2>
            <p className="text-body-sm mt-1 text-content-secondary">{c.center.lat.toFixed(4)}, {c.center.lng.toFixed(4)}{c.districts ? ` · ${c.districts.length}` : ''}</p>
            {c.districts && (
              <div className="mt-3 flex flex-wrap gap-2">
                {c.districts.map((d) => (
                  <Link key={d.slug} href={routes.district(c.slug, d.slug)} className="rounded-full border border-border-default px-3 py-1 text-xs hover:bg-surface-sunken">{d.slug}</Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <SiteFooter />
    </main>
  );
}
