/**
 * Контент-слой атлетов (требование заказчика от 21.09.2026, DS-04).
 *
 * Секция существует для того, кому площадка нужна помимо занятий: атлеты —
 * вторая по важности аудитория после инструкторов. Имя, дисциплины и статус
 * соревнований приходят от инструкторов платформы, у которых есть спортивная
 * карьера.
 *
 * Данные читаются из публичных InstructorProfile и их опыта. Структурированные
 * дисциплины имеют приоритет, а распознавание по старым специализациям остаётся
 * fallback для профилей, которые ещё не были переведены на новое поле.
 */

import "server-only";

import { limits, cacheTags, dataRevalidate } from "@/config";
import { defaultLocale, type Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { defineQuery } from "@/server/query";
import { instructorSelect, publicInstructorWhere, toInstructorCard } from "../queries/instructors";
import type { MediaRef } from "@/domain/content";
import { disciplines } from "@/domain/dancesport";
import { danceSportDisciplines, type DanceSportDiscipline } from "@/domain/enums";



/** Строка секции атлетов. */
export interface AthleteItem {
  slug: string;
  name: string;
  headline: string;
  /** Дисциплины Sport-профиля: слаги из таксономии DanceSport. */
  disciplines: readonly string[];
  /** Направления каталога — для ссылок «расписание этого стиля». */
  styles: readonly string[];
  /** Наибольшее достижение из опыта: 'GOLD' | 'SILVER' | 'BRONZE' | 'FINALIST' | 'PARTICIPANT'. */
  bestResult: string;
  /** Сколько лет спортивной карьеры (из общего стажа — не то же самое). */
  competitionYears: number;
  image: MediaRef;
}

const danceSportDisciplineSlugs = new Set(disciplines.map((item) => item.slug));
const danceSportDisciplineIds = new Set<string>(danceSportDisciplines);

/**
 * Спортивные дисциплины атлета.
 *
 * Старые профили не имеют структурированных дисциплин: то, что упоминает
 * дисциплину Standard/Latine, попадает в список; прочее («Body Movement»,
 * «Salsa On1») — педагогика, а не спорт, и в строку атлета не идёт.
 */
function sportSpecializations(
  specializations: readonly string[],
): readonly string[] {
  const found = specializations.filter((item) => {
    const slug = item.toLowerCase().replace(/[^a-z]+/g, "-");
    for (const discipline of danceSportDisciplineSlugs) {
      if (slug === discipline || slug.includes(discipline)) return true;
    }
    /* Обозначения программ: «Standard», «Latine/Latin program». */
    return /(^|-\s?)(standard|latin[e]?)(-|$|\s)/.test(item.toLowerCase());
  });
  /* Пока ни одна специализация не распознана, показываем программу по стилям. */
  return found;
}

/**
 * Структурированные значения — это enum IDs, поэтому они безопасны для
 * фильтрации и могут быть локализованы на странице. Невалидные значения не
 * должны попадать в публичный ответ даже если старый кеш содержит мусор.
 */
function athleteDisciplines(
  specializations: readonly string[],
  structured: readonly string[] | undefined,
): readonly string[] {
  const normalized = [...new Set((structured ?? []).filter((value): value is DanceSportDiscipline => danceSportDisciplineIds.has(value)))];
  return normalized.length > 0 ? normalized : sportSpecializations(specializations);
}

/**
 * Лучшее достижение по текстам опыта.
 *
 * Порядок проверок — от сильного к слабому: «1st place» в перечислении опыта
 * сильнее «finalist», упомянутого в другой строке.
 */
function bestResultFrom(
  instructor: { experience: readonly { title: string; organization: string | null }[] },
): AthleteItem["bestResult"] {
  const text = (instructor.experience ?? [])
    .map((item) => `${item.title} ${item.organization ?? ""}`)
    .join(" ")
    .toLowerCase();

  if (/\b(1st|first|gold|champion)\b/.test(text)) return "GOLD";
  if (/\b(2nd|second|silver)\b/.test(text)) return "SILVER";
  if (/\b(3rd|third|bronze)\b/.test(text)) return "BRONZE";
  if (/\b(finalist|final)\b/.test(text)) return "FINALIST";
  return "PARTICIPANT";
}

/** Атлеты платформы: инструкторы со спортивным профилем, порядок — по карьере. */
export const getAthletes = defineQuery({
  name: "athletes",
  tags: () => [cacheTags.instructors()],
  revalidate: dataRevalidate.catalog,
  handler: async (locale: Locale = defaultLocale): Promise<readonly AthleteItem[]> => {
    const rows = await db.instructorProfile.findMany({
      where: publicInstructorWhere,
      orderBy: { id: "asc" },
      take: limits.query.maxRows,
      select: {
        ...instructorSelect,
        translations: { where: { locale }, select: { headline: true } },
        experiences: {
          orderBy: { sortOrder: "asc" },
          select: { title: true, organization: true, startYear: true, endYear: true },
        },
      },
    });
    return rows.map((row) => {
      const instructor = toInstructorCard(row);
      const experience = row.experiences;
      /*
       * Протяжённость карьеры — охват опыта, а не сумма лет: параллельные
       * этапы не удваиваются. Эндпойнт открытого этапа — текущий год.
       */
      const currentYear = new Date().getFullYear();
      const competitionYears =
        experience.length === 0
          ? 0
          : Math.max(...experience.map((item) => item.endYear ?? currentYear)) -
            Math.min(...experience.map((item) => item.startYear));

      return {
        slug: instructor.slug,
        name: instructor.name,
        headline: row.translations[0]?.headline ?? instructor.headline,
        disciplines: athleteDisciplines(row.specializations, row.danceSportDisciplines),
        styles: instructor.styles,
        bestResult: bestResultFrom({ experience }),
        competitionYears,
        image: instructor.image,
      } satisfies AthleteItem;
    })
    .sort((a, b) => b.competitionYears - a.competitionYears);
  },
});
