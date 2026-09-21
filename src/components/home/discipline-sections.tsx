/**
 * DISCIPLINE SECTIONS — таксономия DanceSport на лендинге (DS-01, DS-02).
 *
 * Две карточки специализаций — Standard и Latine, по пять дисциплин. Данные —
 * из `src/domain/dancesport.ts`, тексты — из i18n; ссылки «расписание» ведут в
 * каталог по стилю (`BALLROOM` → `/classes?style=ballroom`): занятия физически
 * сидят в стилях каталога, и дисциплина без стиля была бы ссылкой в пустоту.
 *
 * Синхронный компонент с `useTranslations` — паттерн соседних home-секций;
 * в серверную сборку попадает без пометки «use client», потому что ни
 * взаимодействия, ни состояния здесь нет.
 */

import { useTranslations } from "next-intl";

import { Reveal } from "@/components/fx/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { routes } from "@/config";
import {
  disciplineLabelKey,
  latineDisciplines,
  standardDisciplines,
  type Discipline,
} from "@/domain/dancesport";
import { danceStyleSlug } from "@/domain/enums";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/routing";

interface DisciplineSectionsProps {
  locale: Locale;
}

export function DisciplineSections({ locale }: DisciplineSectionsProps) {
  void locale;
  const t = useTranslations("dancesport");
  const tHome = useTranslations("home");
  /** Корневой переводчик — для ключей, собранных из данных (`MessageKey`). */
  const tRoot = useTranslations();

  const groups = [
    {
      title: t("standardTitle"),
      note: t("standardNote"),
      items: standardDisciplines,
    },
    {
      title: t("latineTitle"),
      note: t("latineNote"),
      items: latineDisciplines,
    },
  ] as const;

  return (
    <section className="section-y" aria-label="DanceSport disciplines">
      <div className="page-container">
        <Reveal className="mb-12">
          <SectionHeading
            align="center"
            eyebrow={tHome("competitions.eyebrow")}
            title={tHome("competitions.title")}
            subtitle={tHome("competitions.subtitle")}
            className="mb-0"
          />
        </Reveal>

        <Reveal
          as="div"
          variant="stagger"
          className="grid gap-5 lg:grid-cols-2"
        >
          {groups.map((group) => (
            <div
              key={group.title}
              className="rounded-xl border border-border-default bg-surface-card p-8"
            >
              <h3 className="text-card-title">{group.title}</h3>
              <p className="text-body-sm mt-2 text-content-secondary">
                {group.note}
              </p>
              <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {group.items.map((discipline: Discipline) => (
                  <li
                    key={discipline.slug}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-body">
                      {tRoot(disciplineLabelKey(discipline.id))}
                    </span>
                    <Link
                      href={routes.classes({
                        style: danceStyleSlug(discipline.style),
                      })}
                      className="text-label text-content-accent hover:underline"
                    >
                      {t("viewSchedule")}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
