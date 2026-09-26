/**
 * SOCIAL EVENTS — афиша-срез: только события типа SOCIAL.
 *
 * Зеркало `/competitions`: одна афиша, другой предзаданный тип. Так требование
 * заказчика («social events — bachata, salsa, kizomba, tango, folk») закрыто
 * существующей инфраструктурой каталога без новой сущности.
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
    namespace: "seo.socialEvents",
  });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.socialEvents(),
    title: t("title"),
    description: t("description"),
  });
}

export default async function SocialEventsPage({
  params,
  searchParams,
}: PageProps) {
  if (!features.events) notFound();

  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const query = {
    ...parseCatalogQuery(await searchParams),
    type: "SOCIAL" as const,
  };
  const result = await getEventList(query);

  const t = await getTranslations("socialEvents");

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        eyebrow="Social"
        image={getDancesportHero("socialEvents")}
        locale={locale as Locale}
        breadcrumbs={[{ label: t("title") }]}
      />

      <CatalogShell
        query={query}
        result={result}
        facets={{}}
        sorts={eventSortOptions}
        section="events"
      >
        <ul className="grid gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
