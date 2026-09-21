/**
 * FEDERATIONS — федерации WDSF и WDC (DS-05).
 *
 * Контентная страница: две карточки федераций со ссылками на официальные сайты
 * и блок «в Армении». Национальный календарь (National & International, DS-03)
 * упоминается здесь и живёт в афише `/competitions`.
 */

import type { Metadata } from "next";
import { ExternalLinkIcon, LandmarkIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContentSection } from "@/components/content/content-section";
import { PageHero, breadcrumbsFromTrail } from "@/components/layout/page-hero";
import { SiteFooter } from "@/components/layout/site-footer";
import { routes, site } from "@/config";
import { federations, federationDescriptionKey } from "@/domain/dancesport";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/routing";
import type { Crumb } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getDancesportHero } from "@/server/content/catalog";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "seo.federations",
  });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.federations(),
    title: t("title"),
    description: t("description"),
  });
}

export default async function FederationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("federations");
  const tRoot = await getTranslations();

  const trail: Crumb[] = [{ name: t("eyebrow"), path: routes.federations() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        eyebrow={t("eyebrow")}
        image={getDancesportHero("federations")}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection>
        <ul className="grid gap-6 md:grid-cols-2">
          {federations.map((federation) => (
            <li
              key={federation.id}
              className="flex flex-col rounded-xl border border-border-default bg-surface-card p-8"
            >
              <div className="flex items-center gap-3">
                <LandmarkIcon
                  className="size-6 text-content-accent"
                  aria-hidden
                />
                <h3 className="text-card-title">{federation.name}</h3>
              </div>
              {federation.preferred && (
                <span className="mt-3 w-fit rounded-full bg-accent-soft px-3 py-1 text-2xs uppercase text-content-accent">
                  {t("preferredBadge")}
                </span>
              )}
              <p className="text-body mt-4 text-content-secondary">
                {tRoot(federationDescriptionKey(federation.id))}
              </p>
              <a
                href={federation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-label mt-6 inline-flex items-center gap-1.5 text-content-accent hover:underline"
              >
                {t("visitSite")}
                <ExternalLinkIcon className="size-4" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection tone="raised" title={t("nationalTitle")}>
        <p className="text-body-lg text-content-secondary">
          {t("nationalBody")}
        </p>
        <div className="mt-6">
          <Link
            href={routes.competitions()}
            className="text-label text-content-accent hover:underline"
          >
            {tRoot("nav.competitions")}
          </Link>
        </div>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
