/**
 * SPONSORS — донаты и спонсорство (DS-07).
 *
 * Три спонсорских пакета + блок прозрачности. Формы приёма донатов на странице
 * нет: платёжный путь появится вместе с эквайрингом (шаг 0.6 плана), а до тех
 * пор CTA ведёт на контактную страницу — честный выход вместо кнопки, которая
 * никуда не ведёт.
 */

import type { Metadata } from "next";
import { GiftIcon, GraduationCapIcon, TrophyIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContentSection } from "@/components/content/content-section";
import { PageHero, breadcrumbsFromTrail } from "@/components/layout/page-hero";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { routes, site } from "@/config";
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
    namespace: "seo.sponsors",
  });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.sponsors(),
    title: t("title"),
    description: t("description"),
  });
}

export default async function SponsorsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("sponsors");

  const trail: Crumb[] = [{ name: t("eyebrow"), path: routes.sponsors() }];

  const packages = [
    { key: "packageEvent", icon: TrophyIcon },
    { key: "packageTeam", icon: GiftIcon },
    { key: "packageScholarship", icon: GraduationCapIcon },
  ] as const;

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        eyebrow={t("eyebrow")}
        image={getDancesportHero("sponsors")}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection title={t("packagesTitle")}>
        <ul className="grid gap-6 md:grid-cols-3">
          {packages.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="flex flex-col rounded-xl border border-border-default bg-surface-card p-8"
            >
              <Icon className="size-6 text-content-accent" aria-hidden />
              <h3 className="text-card-title mt-4">{t(`${key}.title`)}</h3>
              <p className="text-body-sm mt-3 text-content-secondary">
                {t(`${key}.body`)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.contact()}>{t("supportCta")}</Link>
          </Button>
        </div>
      </ContentSection>

      <ContentSection tone="raised" title={t("transparencyTitle")}>
        <p className="text-body-lg text-content-secondary">
          {t("transparencyBody")}
        </p>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
