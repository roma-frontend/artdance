/**
 * DANCESPORT — таксономия соревновательных и социальных направлений.
 *
 * Требование заказчика от 21.09.2026: платформа строится вокруг DanceSport
 * (спортивные бальные танцы) с двумя специализациями — Standard и Latine —
 * и вокруг социальных танцев (bachata, salsa, Argentine tango, качественные
 * «прочие»). Роль DanceSport в бренде — главная, роль Social — вторая.
 *
 * Здесь живёт только структура знания (какие дисциплины, в какой специализации,
 * как называются), а не то, где оно показывается. Экраны собирают её из
 * `src/domain/enums.ts` (существующие `DanceStyle`) и отсюда.
 *
 * Термины зафиксированы по WDSF: специализация официально называется
 * «Latine», дисциплина Standard — «Viennese Waltz» (в письме заказчика было
 * «Venice Waltz» — берём официальное написание, см. worlddancesport.org).
 */

/* ─────────────────── Дисциплины Standard (5) ─────────────────── */

/**
 * Пять дисциплин Standard (исторически «Modern Standard»).
 *
 * Каждая привязана к существующему `DanceStyle`: слаги стилей уже
 * проиндексированы (`/styles/tango`), а статистика занятий живёт по стилям —
 * дисциплина без стиля была бы отдельным каталогом из пустых страниц.
 */
import type { MessageKey } from "@/i18n/types";

import type { DanceStyle } from "./enums";

export const standardDisciplines = [
  {
    id: "SLOW_WALTZ",
    slug: "slow-waltz",
    style: "BALLROOM" as const,
  },
  {
    id: "TANGO_STANDARD",
    slug: "tango-standard",
    style: "TANGO",
  },
  {
    id: "VIENNESE_WALTZ",
    slug: "viennese-waltz",
    style: "BALLROOM",
  },
  {
    id: "SLOW_FOXTROT",
    slug: "slow-foxtrot",
    style: "BALLROOM",
  },
  {
    id: "QUICKSTEP",
    slug: "quickstep",
    style: "BALLROOM",
  },
] as const;

/* ─────────────────── Дисциплины Latine (5) ─────────────────── */

export const latineDisciplines = [
  {
    id: "SAMBA",
    slug: "samba",
    style: "LATIN",
  },
  {
    id: "CHACHACHA",
    slug: "chachacha",
    style: "LATIN",
  },
  {
    id: "RUMBA",
    slug: "rumba",
    style: "LATIN",
  },
  {
    id: "PASODOBLE",
    slug: "pasodoble",
    style: "LATIN",
  },
  {
    id: "JIVE",
    slug: "jive",
    style: "LATIN",
  },
] as const;

export type DisciplineId =
  | (typeof standardDisciplines)[number]["id"]
  | (typeof latineDisciplines)[number]["id"];

/** Дисциплина в URL и в ключах перевода. */
export interface Discipline {
  id: DisciplineId;
  slug: string;
  /** Стиль каталога, к которому ведут ссылки «расписание дисциплины». */
  style: DanceStyle;
}

/**
 * Единый порядок: сначала Standard, потом Latine — порядок из письма
 * заказчика и из правил WDSF (по возрастанию темпа в каждой специализации).
 */
export const disciplines: readonly Discipline[] = [
  ...standardDisciplines,
  ...latineDisciplines,
];

const disciplinesBySlug = new Map(disciplines.map((item) => [item.slug, item]));

/** Слаг дискретен: он попадает в URL, и чужой слаг не должен молча пройти. */
export function disciplineFromSlug(slug: string): Discipline | undefined {
  return disciplinesBySlug.get(slug);
}

/**
 * Ключ перевода названия дисциплины.
 *
 * Литеральные значения, а не шаблонная сборка: тип `MessageKey` делает
 * опечатку ошибкой сборки, а не `MISSING_MESSAGE` в рантайме.
 */
const disciplineLabelKeys = {
  SLOW_WALTZ: "dancesport.disciplines.slow-waltz",
  TANGO_STANDARD: "dancesport.disciplines.tango-standard",
  VIENNESE_WALTZ: "dancesport.disciplines.viennese-waltz",
  SLOW_FOXTROT: "dancesport.disciplines.slow-foxtrot",
  QUICKSTEP: "dancesport.disciplines.quickstep",
  SAMBA: "dancesport.disciplines.samba",
  CHACHACHA: "dancesport.disciplines.chachacha",
  RUMBA: "dancesport.disciplines.rumba",
  PASODOBLE: "dancesport.disciplines.pasodoble",
  JIVE: "dancesport.disciplines.jive",
} as const satisfies Record<DisciplineId, MessageKey>;

export function disciplineLabelKey(id: DisciplineId): MessageKey {
  return disciplineLabelKeys[id];
}

/* ─────────────────── Социальные танцы ─────────────────── */

/**
 * Социальная программа. Первый блок — ядро (перечислено заказчиком), дальше —
 * «прочие» направления, которые в социальных разделах показываются агрегатом.
 * Argentine tango вынесен первым: заказчик упомянул его отдельной строкой.
 */
export const socialCoreStyles = [
  "TANGO",
  "BACHATA",
  "SALSA",
  "KIZOMBA",
] as const;

/**
 * Направления каталога, которые социальная программа НЕ раскрывает по
 * отдельности: они попадают в общее «other»-агрегирование на карточке Social.
 * Соревновательные (BALLROOM, LATIN) и клубные направления здесь не перечислены.
 */
export const socialOtherStyles = [
  "ARMENIAN_FOLK",
  "WEDDING_DANCE",
  "AFRO",
  "FLAMENCO",
  "HEELS",
  "JAZZ",
  "CONTEMPORARY",
] as const;

/* ─────────────────── Федерацийный блок ─────────────────── */

/**
 * Две мировые федерации спортивного танца, обе представлены в Армении.
 * Заказчик состоит в WDSF, и платформа следует его календарю — отсюда порядок
 * и поле `preferred`.
 */
export const federations = [
  {
    id: "WDSF",
    name: "World DanceSport Federation",
    short: "WDSF",
    url: "https://www.worlddancesport.org/",
    preferred: true,
  },
  {
    id: "WDC",
    name: "World Dance Council",
    short: "WDC",
    url: "https://www.wdcdance.com/",
    preferred: false,
  },
] as const;

export type FederationId = (typeof federations)[number]["id"];

const federationDescriptionKeys = {
  WDSF: "dancesport.federations.WDSF",
  WDC: "dancesport.federations.WDC",
} as const satisfies Record<FederationId, MessageKey>;

/** Ключ перевода описания федерации. */
export function federationDescriptionKey(id: FederationId): MessageKey {
  return federationDescriptionKeys[id];
}
