/**
 * ATHLETES — атлеты платформы (DS-04).
 *
 * Страничка секции сообщества: у каждой строки — дисциплины, лучший результат и
 * переход к бронированию у инструктора. Данные читает контент-слой
 * (`getAthletes`): сегодня фикстуры, завтра база — компонент не меняется.
 */

import type { Metadata } from "next";
import { MedalIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContentSection } from "@/components/content/content-section";
import { PageHero, breadcrumbsFromTrail } from "@/components/layout/page-hero";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/ui/media";
import { routes, site } from "@/config";
import { resolveMedia, type MediaRef } from "@/domain/content";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/routing";
import type { Crumb } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getAthletes, type AthleteItem } from "@/server/content/athletes";
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
    namespace: "seo.athletes",
  });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.athletes(),
    title: t("title"),
    description: t("description"),
  });
}

const resultLabelKeys = {
  GOLD: "resultGold",
  SILVER: "resultSilver",
  BRONZE: "resultBronze",
  FINALIST: "resultFinalist",
  PARTICIPANT: "resultParticipant",
} as const;

export default async function AthletesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("athletes");
  const athletes = getAthletes();

  const trail: Crumb[] = [{ name: t("eyebrow"), path: routes.athletes() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        eyebrow={t("eyebrow")}
        image={getDancesportHero("athletes")}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection>
        {athletes.length === 0 ? (
          <p className="text-body-lg text-content-secondary">{t("empty")}</p>
        ) : (
          <ul className="grid gap-6 lg:grid-cols-2">
            {athletes.map((athlete: AthleteItem) => (
              <li
                key={athlete.slug}
                className="flex flex-col gap-5 rounded-xl border border-border-default bg-surface-card p-6 sm:flex-row"
              >
                <div className="w-full max-w-40 shrink-0 sm:w-40">
                  <Media
                    {...resolveMedia(
                      athlete.image as MediaRef,
                      locale as Locale,
                    )}
                    preset="instructorCard"
                    fallback="instructor"
                    imageClassName="aspect-3/4 object-cover"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-card-title">{athlete.name}</h3>
                      <p className="text-body-sm text-content-secondary">
                        {athlete.headline}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-2xs uppercase text-content-accent">
                      <MedalIcon className="size-3.5" aria-hidden />
                      {t(
                        resultLabelKeys[
                          athlete.bestResult as keyof typeof resultLabelKeys
                        ],
                      )}
                    </span>
                  </div>

                  <p className="text-label mt-3 text-content-secondary">
                    {t("disciplinesTitle")}:
                  </p>
                  <p className="text-body-sm">
                    {athlete.disciplines.join(" · ") ||
                      athlete.styles.join(" · ")}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                    <span className="text-body-sm text-content-secondary">
                      {t("years", { count: athlete.competitionYears })}
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link href={routes.instructor(athlete.slug)}>
                        {t("bookLesson")}
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
