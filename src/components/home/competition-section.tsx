/**
 * COMPETITION SECTION — DanceSport-блок лендинга (DS-02, DS-05, DS-09).
 *
 * Одна секция закрывает три требования заказчика от 21.09.2026:
 *   • DS-02 — DanceSport как главное направление в лендинге;
 *   • DS-09 — видео с недавних соревнований (канал WDSF Armenia).
 *     Пока клип не закодирован (`video === null`), блок показывает постер —
 *     раскладка не зависит от наличия файла, как у hero и editorial;
 *   • ссылка на /federations — блок федераций живёт отдельной страницей (DS-05).
 *
 * Компонент переиспользует `EditorialVideo`: та же механика автопетли, пауза
 * вне видимости, постер-фоллбэк — второй экземпляр той же логики был бы
 * копипастой, которая рассинхронится при первой же правке конвейера.
 */

import { useTranslations } from "next-intl";

import { EditorialVideo } from "@/components/home/editorial-video";
import { Reveal } from "@/components/fx/reveal";
import { SectionParallax } from "@/components/fx/section-parallax";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { routes } from "@/config";
import type { MediaRef, VideoRef } from "@/domain/content";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/routing";

interface CompetitionSectionProps {
  /** Фоновая петля соревнований. `null`, пока клип не закодирован. */
  video: VideoRef | null;
  /** Постер: показывается до старта видео и вместо него. */
  image: MediaRef;
  locale: Locale;
}

export function CompetitionSection({
  video,
  image,
  locale,
}: CompetitionSectionProps) {
  const t = useTranslations("home.competitions");
  const tRoot = useTranslations();

  return (
    <SectionParallax>
      <section className="cinema-surface section-y-wide relative overflow-hidden text-center">
        <div
          aria-hidden
          data-parallax="background"
          className="absolute inset-0"
        >
          <EditorialVideo video={video} poster={image} locale={locale} />
        </div>

        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: "var(--scrim-editorial-radial)" }}
        />

        <Reveal variant="scale" className="page-container relative">
          <SectionHeading
            parallax
            align="center"
            eyebrow={t("eyebrow")}
            title={t("title")}
            subtitle={t("subtitle")}
            className="mb-0"
          />

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" variant="accent">
              <Link href={routes.competitions()}>{t("videoCta")}</Link>
            </Button>
            <Button asChild size="lg" variant="onCinema" className="liquid-glass">
              <Link href={routes.federations()}>
                {tRoot("footer.federations")}
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </SectionParallax>
  );
}
