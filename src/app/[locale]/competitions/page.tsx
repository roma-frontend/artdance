/**
 * COMPETITIONS — афиша-срез: только события типа COMPETITION (+ CONCERT).
 *
 * Раздел требован заказчиком 21.09.2026 (National & International sections).
 * Реализация — афиша `/events` с предзаданным `type`, а не отдельный маршрут:
 * одна афиша, разные срезы. Canonical у обоих адресов — сама афиша, поэтому
 * дубликатов в выдаче нет, а в sitemap попадает только `/events`.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CatalogShell } from "@/components/catalog/catalog-shell";
import { EventCard } from "@/components/catalog/event-card";
import { CardTilt } from "@/components/fx/card-tilt";
import { PageHero } from "@/components/layout/page-hero";
import { SiteFooter } from "@/components/layout/site-footer";
import { features, routes, site } from "@/config";
import { parseCatalogQuery, type RawSearchParams } from "@/domain/catalog";
import type { Locale } from "@/i18n/config";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  eventSortOptions,
  getDancesportHero,
  getEventList,
  getVenueFacets,
} from "@/server/content/catalog";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "seo.competitions",
  });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.competitions(),
    title: t("title"),
    description: t("description"),
  });
}

export default async function CompetitionsPage({
  params,
  searchParams,
}: PageProps) {
  if (!features.events) notFound();

  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const query = {
    ...parseCatalogQuery(await searchParams),
    type: "COMPETITION" as const,
  };
  const result = await getEventList(query);

  const t = await getTranslations("competitions");
  const tNav = await getTranslations("nav");
  void tNav;

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        eyebrow={tNav("competitions")}
        image={getDancesportHero("competitions")}
        locale={locale as Locale}
        breadcrumbs={[{ label: tNav("competitions") }]}
      />

      <CatalogShell
        query={query}
        result={result}
        facets={{}}
        sorts={eventSortOptions}
        section="events"
      >
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <li key={item.slug}>
              <CardTilt>
                <EventCard item={item} locale={locale as Locale} />
              </CardTilt>
            </li>
          ))}
        </ul>
      </CatalogShell>

      <SiteFooter />
    </main>
  );
}
