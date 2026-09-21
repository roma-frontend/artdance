/**
 * Контент-слой атлетов (требование заказчика от 21.09.2026, DS-04).
 *
 * Секция существует для того, кому площадка нужна помимо занятий: атлеты —
 * вторая по важности аудитория после инструкторов. Имя, дисциплины и статус
 * соревнований приходят от инструкторов платформы, у которых есть спортивная
 * карьера.
 *
 * Место в шве «фикстуры → база»: сегодня данные читаются из демо-фикстур
 * (`experience`, `specializations`), завтра запрос уйдёт в `InstructorProfile`
 * + новая таблица достижений, и компонент страницы не заметит разницы.
 * Реализация меняется здесь — сигнатуры и форма результата стабильны.
 */

import "server-only";

import { demoInstructors } from "../../../prisma/fixtures/demo";
import { standardDisciplines } from "@/domain/dancesport";

import { mediaRef } from "./media";

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
  image: ReturnType<typeof mediaRef>;
}

const standardSlugs = new Set(standardDisciplines.map((item) => item.slug));

/**
 * Спортивные дисциплины атлета.
 *
 * Слагов дисциплин в фикстурах нет — они собираются из специализаций: то, что
 * упоминает дисциплину Standard/Latine, попадает в список; прочее («Body
 * Movement», «Salsa On1») — это педагогика, а не спорт, и в строку атлета не идёт.
 */
function sportSpecializations(
  specializations: readonly string[],
): readonly string[] {
  const found = specializations.filter((item) => {
    const slug = item.toLowerCase().replace(/[^a-z]+/g, "-");
    for (const discipline of standardSlugs) {
      if (slug === discipline || slug.includes(discipline)) return true;
    }
    /* Обозначения программ: «Standard», «Latine/Latin program». */
    return /(^|-\s?)(standard|latin[e]?)(-|$|\s)/.test(item.toLowerCase());
  });
  /* Пока ни одна специализация не распознана, показываем программу по стилям. */
  return found;
}

/**
 * Лучшее достижение по текстам опыта.
 *
 * Порядок проверок — от сильного к слабому: «1st place» в перечислении опыта
 * сильнее «finalist», упомянутого в другой строке.
 */
function bestResultFrom(
  instructor: (typeof demoInstructors)[number],
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
export function getAthletes(): readonly AthleteItem[] {
  return demoInstructors
    .map((instructor) => {
      const experience = instructor.experience ?? [];
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
        headline: instructor.headline,
        disciplines: sportSpecializations(instructor.specializations),
        styles: instructor.styles,
        bestResult: bestResultFrom(instructor),
        competitionYears,
        image: mediaRef(instructor.asset),
      } satisfies AthleteItem;
    })
    .sort((a, b) => b.competitionYears - a.competitionYears);
}
