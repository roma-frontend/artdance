/**
 * Инварианты таксономии DanceSport.
 *
 * Проверяются свойства, поломка которых видна только на странице: дисциплина
 * без перевода, слаг без дисциплины, ссылка «расписание» в пустой каталог.
 */

import { describe, expect, it } from "vitest";

import {
  disciplines,
  disciplineFromSlug,
  disciplineLabelKey,
  federations,
  latineDisciplines,
  socialCoreStyles,
  socialOtherStyles,
  standardDisciplines,
} from "./dancesport";
import { danceStyles, danceStyleFromSlug, danceStyleLabelKey } from "./enums";
import en from "@/i18n/messages/en";
import hy from "@/i18n/messages/hy";
import ru from "@/i18n/messages/ru";

const messages = { en, ru, hy } as const;

function pick(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => {
    if (
      node &&
      typeof node === "object" &&
      part in (node as Record<string, unknown>)
    ) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, root);
}

describe("таксономия дисциплин", () => {
  it("ровно пять Standard и пять Latine — состав WDSF", () => {
    expect(standardDisciplines).toHaveLength(5);
    expect(latineDisciplines).toHaveLength(5);
    expect(disciplines).toHaveLength(10);
  });

  it("слаги уникальны и обратимы", () => {
    const slugs = disciplines.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const slug of slugs) {
      expect(disciplineFromSlug(slug)?.slug).toBe(slug);
    }
    expect(disciplineFromSlug("no-such-discipline")).toBeUndefined();
  });

  it("каждая дисциплина ведёт в существующий стиль каталога", () => {
    for (const discipline of disciplines) {
      expect(
        danceStyles.includes(discipline.style as (typeof danceStyles)[number]),
        `дисциплина ${discipline.slug} ссылается на несуществующий стиль ${discipline.style}`,
      ).toBe(true);
    }
  });

  it("танго встречается и в Standard, и в Social: это два разных слага", () => {
    /* Дисциплина соревнований и социальный стиль не путаются в URL. */
    expect(standardDisciplines.some((item) => item.style === "TANGO")).toBe(
      true,
    );
    expect(socialCoreStyles).toContain("TANGO");
  });
});

describe("переводы таксономии", () => {
  it.each(["en", "ru", "hy"] as const)(
    "%s: у каждой дисциплины есть название",
    (locale) => {
      for (const discipline of disciplines) {
        const value = pick(messages[locale], disciplineLabelKey(discipline.id));
        expect(
          value,
          `${locale}: нет названия для ${discipline.id}`,
        ).toBeTruthy();
      }
    },
  );

  it.each(["en", "ru", "hy"] as const)(
    "%s: у каждой федерации есть описание",
    (locale) => {
      for (const federation of federations) {
        const value = pick(
          messages[locale],
          `dancesport.federations.${federation.id}`,
        );
        expect(
          value,
          `${locale}: нет описания для ${federation.id}`,
        ).toBeTruthy();
      }
    },
  );

  it.each(["en", "ru", "hy"] as const)(
    "%s: ключи стилей-соседей существуют (ссылки на расписание)",
    (locale) => {
      for (const discipline of disciplines) {
        const key = danceStyleLabelKey(
          danceStyleFromSlug(discipline.style.toLowerCase())!,
        );
        expect(pick(messages[locale], key), `${locale}: ${key}`).toBeTruthy();
      }
    },
  );
});

describe("социальные стили", () => {
  it("ядро Social существует в каталоге стилей", () => {
    for (const style of socialCoreStyles) {
      expect(danceStyles).toContain(style);
    }
  });

  it("агрегат «прочие» не пересекается с ядром и существует в каталоге", () => {
    for (const style of socialOtherStyles) {
      expect(socialCoreStyles).not.toContain(style);
      expect(danceStyles).toContain(style);
    }
  });
});

describe("федерации", () => {
  it("WDSF первый и предпочтительный — платформа следует его календарю", () => {
    expect(federations[0]?.id).toBe("WDSF");
    expect(federations[0]?.preferred).toBe(true);
    expect(federations.filter((item) => item.preferred)).toHaveLength(1);
  });

  it("ссылки на официальные сайты — https", () => {
    for (const federation of federations) {
      expect(federation.url).toMatch(/^https:\/\//);
    }
  });
});
