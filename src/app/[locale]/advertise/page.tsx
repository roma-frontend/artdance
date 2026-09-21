/**
 * ADVERTISE — реклама на платформе (DS-08).
 *
 * Три рекламных формата + портрет аудитории. Цены не публикуются: медиакит
 * живёт у владельца, и страница его запрашивает — публиковать прайс, который
 * меняется каждый сезон, означало бы завести на сайте врущий текст.
 */

import type { Metadata } from "next";
import { MailIcon, MegaphoneIcon, NewspaperIcon, StarIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContentSection } from "@/components/content/content-section";
import { PageHero, breadcrumbsFromTrail } from "@/components/layout/page-hero";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { routes, site } from "@/config";
import type { Locale } from "@/i18n/config";
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
    namespace: "seo.advertise",
  });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.advertise(),
    title: t("title"),
    description: t("description"),
  });
}

export default async function AdvertisePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("advertise");

  const trail: Crumb[] = [{ name: t("eyebrow"), path: routes.advertise() }];

  const formats = [
    { key: "formatBanner", icon: MegaphoneIcon },
    { key: "formatFeatured", icon: StarIcon },
    { key: "formatNewsletter", icon: NewspaperIcon },
  ] as const;

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        eyebrow={t("eyebrow")}
        image={getDancesportHero("advertise")}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection title={t("formatsTitle")}>
        <ul className="grid gap-6 md:grid-cols-3">
          {formats.map(({ key, icon: Icon }) => (
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
      </ContentSection>

      <ContentSection tone="raised" title={t("audienceTitle")}>
        <p className="text-body-lg text-content-secondary">
          {t("audienceBody")}
        </p>
        <div className="mt-8 text-center">
          <Button asChild size="lg" variant="accent">
            <a href={`mailto:${site.contact.email}`}>
              <MailIcon className="size-4" aria-hidden />
              {t("contactCta")}
            </a>
          </Button>
        </div>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
