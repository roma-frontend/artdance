/**
 * Контент главной страницы.
 *
 * **Это единственный шов между «данными из фикстур» и «данными из базы».**
 * Сегодня функция собирает контент из демо-фикстур прототипа, потому что базы
 * ещё нет (задача 1.1 плана). Когда она появится, меняется реализация этой
 * функции — и ни одного компонента.
 *
 * Так сделано намеренно. Альтернатива — импортировать фикстуры прямо в секции —
 * привела бы к тому, что при подключении базы пришлось бы править десяток
 * компонентов, и каждый из них знал бы про имена файлов. Требование заказчика
 * «все фото и видео управляются из админки» означает, что медиа обязано быть
 * данными, а не литералом в разметке.
 *
 * Что здесь появится при переходе на базу (задача 2.1):
 *   • запрос к `MediaAsset` + `MediaAssetTranslation` вместо `demoMediaAlt`;
 *   • блоки главной из `ContentBlock` (`docs/07-feature-backlog.md`, A-17);
 *   • кеш и теги из `src/config/cache.ts` вокруг вызова;
 *   • показатели из аналитики вместо `demoHeroStats`.
 */

import 'server-only';

import {
  demoClasses,
  demoEvents,
  demoHeroStats,
  demoInstructors,
  demoMediaAlt,
  demoProducts,
  demoReviews,
  demoStyleTiles,
  demoVenues,
} from '../../../prisma/fixtures/demo';
import { booking } from '@/config';
import type { HomeContent, LocalizedText, MediaRef, VideoRef } from '@/domain/content';
import {
  heroVideoDurationSeconds,
  heroVideoSources,
} from '@/design/hero-video.generated';

/**
 * Описание изображения на трёх языках. Отсутствие описания — не повод показать
 * пустой `alt`: это ошибка контента, и она должна быть заметна на разработке.
 */
function altFor(key: string): LocalizedText {
  const alt = demoMediaAlt[key];
  if (!alt) {
    throw new Error(
      `[content] Нет alt-текста для ассета «${key}». Добавьте его в prisma/fixtures/demo.ts ` +
        '(в production — MediaAsset.altText и переводы).',
    );
  }
  return alt;
}

function mediaRef(key: string, focalPoint?: string): MediaRef {
  return focalPoint ? { key, alt: altFor(key), focalPoint } : { key, alt: altFor(key) };
}

/**
 * Фоновая петля первого экрана.
 *
 * Файлы собраны `npm run video:encode` из исходника макета (20,6 МБ, 1920×1080,
 * 8 с) по политике `videoProcessing.heroLoop`: 1280px, 24 fps, без звука, три
 * формата — 591 KB (AV1), 664 KB (VP9), 1075 KB (H.264). Браузер скачивает
 * ровно один из них, поэтому пользователь платит за самый лёгкий, который
 * поддерживает.
 *
 * Вес и длительность берутся из генерируемого манифеста, а не пишутся руками:
 * иначе отчёт о бюджете и админка рассказывали бы о файле то, чего в нём нет.
 *
 * Здесь же — единственное место, которое изменится при появлении бакета: путь
 * `/media/video/…` станет ключом объекта в R2, а компоненты не заметят разницы.
 */
function heroVideo(): VideoRef | null {
  if (heroVideoSources.length === 0) return null;

  const lightest = heroVideoSources.reduce((min, item) => (item.bytes < min.bytes ? item : min));

  return {
    sources: heroVideoSources.map((item) => ({
      format: item.format,
      url: `/media/video/${item.file}`,
    })),
    /** Постер — первый кадр этой же петли (`designVideos[].poster` в манифесте). */
    poster: mediaRef('hero-dancer'),
    durationSeconds: heroVideoDurationSeconds,
    bytes: lightest.bytes,
  };
}

export function getHomeContent(): HomeContent {
  /** Имя инструктора для карточки занятия: в БД это join, здесь — поиск по slug. */
  const instructorName = (slug: string): string => {
    const instructor = demoInstructors.find((item) => item.slug === slug);
    if (!instructor) {
      throw new Error(`[content] Занятие ссылается на неизвестного инструктора «${slug}».`);
    }
    return instructor.name;
  };

  /** Название площадки для события. Та же связь, что в БД будет join'ом. */
  const venueName = (slug: string): string => {
    const venue = demoVenues.find((item) => item.slug === slug);
    if (!venue) {
      throw new Error(`[content] Событие ссылается на неизвестную площадку «${slug}».`);
    }
    return venue.name;
  };

  /**
   * Дата события из `MM-DD`.
   *
   * В фикстурах год не указан намеренно: демо-данные не должны «истекать» — с
   * годом из макета события через год стали бы прошедшими. Год берётся текущий,
   * а если дата уже прошла — следующий, чтобы подборка «предстоящих» оставалась
   * предстоящей. В production дата приходит из БД целиком.
   */
  const eventDate = (monthDay: string): Date => {
    const [month, day] = monthDay.split('-').map(Number);
    const now = new Date();
    const candidate = new Date(Date.UTC(now.getUTCFullYear(), (month ?? 1) - 1, day ?? 1));
    if (candidate.getTime() < now.getTime()) {
      candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
    }
    return candidate;
  };

  return {
    hero: {
      video: heroVideo(),
      image: mediaRef('hero-dancer'),
      stats: demoHeroStats,
    },
    styleTiles: demoStyleTiles.map((tile) => ({
      style: tile.style,
      image: mediaRef(tile.asset),
      classCount: tile.classCount,
    })),
    editorial: {
      image: mediaRef('editorial-rhythm'),
    },
    /**
     * «Популярное сейчас». Сегодня — порядок фикстуры (сначала трендовые), в
     * production — сортировка по числу броней за `dataRevalidate` последних дней.
     */
    popularClasses: [...demoClasses]
      .sort((a, b) => Number(b.isTrending) - Number(a.isTrending))
      .map((item) => ({
        slug: item.slug,
        title: item.title,
        style: item.style,
        level: item.level,
        instructorName: instructorName(item.instructorSlug),
        weekday: item.weekday,
        startTime: item.startTime,
        durationMinutes: item.durationMinutes,
        price: item.price,
        spotsLeft: item.spotsLeft,
        /** Лист ожидания включается флагом бизнес-правил, а не полем контента. */
        waitlistOpen: booking.waitlistEnabled,
        isTrending: item.isTrending,
        image: mediaRef(item.coverAsset ?? item.asset),
      })),
    instructors: demoInstructors.map((item) => ({
      slug: item.slug,
      name: item.name,
      headline: item.headline,
      styles: item.styles,
      yearsExperience: item.yearsExperience,
      hourlyRateFrom: item.hourlyRateFrom,
      ratingAverage: item.ratingAverage,
      ratingCount: item.ratingCount,
      isVerified: item.isVerified,
      image: mediaRef(item.asset),
    })),
    venues: demoVenues.map((item) => ({
      slug: item.slug,
      name: item.name,
      description: item.description,
      district: item.district,
      amenities: item.amenities,
      pricePerHour: item.pricePerHour,
      ratingAverage: item.ratingAverage,
      ratingCount: item.ratingCount,
      image: mediaRef(item.asset),
    })),
    /**
     * Отзывы. В production — только прошедшие модерацию
     * (`reviews.requireModeration`) и подтверждённые покупкой.
     */
    testimonials: demoReviews.map((item) => ({
      id: `${item.targetType}-${item.targetSlug}-${item.authorName}`,
      authorName: item.authorName,
      authorRole: item.authorRole,
      rating: item.rating,
      body: item.body,
      image: mediaRef(item.asset),
    })),
    products: demoProducts.map((item) => {
      /** Цена карточки — минимальная из вариантов: покупатель видит «от чего». */
      const prices = item.variants.map((variant) => variant.price);
      const minPrice = prices.length > 0 ? Math.min(...prices) : item.price;
      const hasRange = prices.some((price) => price !== minPrice);

      return {
        slug: item.slug,
        title: item.title,
        brand: item.brand,
        price: minPrice,
        priceFrom: hasRange || item.isGiftCard === true,
        stock: item.variants.reduce((sum, variant) => sum + variant.stock, 0),
        image: mediaRef(item.asset),
      };
    }),
    events: demoEvents.map((item) => ({
      slug: item.slug,
      title: item.title,
      type: item.type,
      startsAt: eventDate(item.monthDay),
      startTime: item.startTime,
      endTime: item.endTime,
      /**
       * Площадка платформы или внешнее место. В БД это связь с `Venue` либо
       * свободный адрес: у батла на площади нет площадки в каталоге.
       */
      locationName: item.venueSlug ? venueName(item.venueSlug) : (item.locationName ?? ''),
      price: item.price,
      spotsLeft: item.spotsLeft,
      image: mediaRef(item.asset),
    })),
  };
}
