/**
 * КАТАЛОГ — единственный шов между «данными из фикстур» и «данными из базы».
 *
 * Здесь живут две вещи, и обе намеренно вместе.
 *
 * **Отображатели карточек.** `demoClass → ClassCardItem` описан один раз, и его
 * используют главная, `/discover`, `/classes`, профиль инструктора, страница
 * площадки и блок «похожие». Копия этого отображения в каждом источнике контента
 * означала бы, что цена на главной и цена в каталоге однажды разойдутся, — а
 * найдётся это на приёмке.
 *
 * **Запросы листингов и деталей.** Фильтрация, сортировка и пагинация считаются
 * чистыми функциями из `@/domain/catalog`; этот модуль только подаёт им данные и
 * достаёт связи, которые в базе будут `join`, а в фикстурах — поиском по слагу.
 *
 * Что изменится при переходе на базу (задача 2.1 плана):
 *   • `demo*` заменяются запросами Prisma с `select` под ровно эти поля;
 *   • вокруг вызовов появляется `unstable_cache` с тегами из `cacheTags`
 *     и временем из `dataRevalidate`;
 *   • фильтрация уезжает в `where`, сортировка — в `orderBy`, пагинация — в
 *     `skip`/`take`; подписи функций и типы результата не меняются.
 *
 * Ни один компонент об этом переходе не узнает — в этом и смысл шва.
 */

import 'server-only';

import {
  demoClasses,
  demoEvents,
  demoInstructors,
  demoProducts,
  demoReviews,
  demoVenues,
  type DemoClass,
  type DemoEvent,
  type DemoInstructor,
  type DemoProduct,
  type DemoReview,
  type DemoStyleTile,
  type DemoVenue,
} from '../../../prisma/fixtures/demo';
import { booking, reviews as reviewRules } from '@/config/business';
import { routes, type ListingSection } from '@/config/routes';
import {
  availableSorts,
  matchesQuery,
  type CatalogSort,
} from '@/domain/catalog';
import {
  emptyCatalogPage,
  type ClassCardItem,
  type EventCardItem,
  type InstructorCardItem,
  type MediaRef,
  type ProductCardItem,
  type ReviewItem,
  type StyleTileItem,
  type TestimonialItem,
  type VenueCardItem,
} from '@/domain/content';
import {
  danceStyleSlug,
  danceStylesMatchingTerm,
  type DanceStyle,
} from '@/domain/enums';
import {
  isSearchScopeEnabled,
  type SearchHit,
  type SearchHitScope,
  type SearchScope,
} from '@/domain/search';
import { nextOccurrence } from '@/lib/time/schedule';

import { mediaRef } from './media';

/* ─────────────────────────── Связи между сущностями ───────────────────────────
 *
 * В базе это `join`, здесь — поиск по слагу. Функции бросают, а не возвращают
 * `undefined`: ссылка на несуществующего инструктора — сломанные данные, и узнать
 * об этом нужно на разработке, а не увидеть пустое место в карточке.
 */

function instructorBySlug(slug: string): DemoInstructor {
  const found = demoInstructors.find((item) => item.slug === slug);
  if (!found) throw new Error(`[catalog] Неизвестный инструктор «${slug}».`);
  return found;
}

function venueBySlug(slug: string): DemoVenue {
  const found = demoVenues.find((item) => item.slug === slug);
  if (!found) throw new Error(`[catalog] Неизвестная площадка «${slug}».`);
  return found;
}

/**
 * Дата события из `MM-DD`.
 *
 * В фикстурах год не указан намеренно: демо-данные не должны «истекать» — с годом
 * из макета события через год стали бы прошедшими. Год берётся текущий, а если
 * дата уже прошла — следующий, чтобы подборка «предстоящих» оставалась
 * предстоящей. В production дата приходит из БД целиком.
 */
export function eventDate(monthDay: string, now: Date = new Date()): Date {
  const [month, day] = monthDay.split('-').map(Number);
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), (month ?? 1) - 1, day ?? 1));
  if (candidate.getTime() < now.getTime()) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }
  return candidate;
}

/* ─────────────────────────── Отображатели карточек ─────────────────────────── */

/**
 * Занятия читаются из базы.
 *
 * Функции переехали в `src/server/queries/classes.ts` (задача 2.1) и стали
 * асинхронными. Реэкспорт, а не копия: страницы импортируют контент из одного
 * места, и переезд остальных сущностей не меняет ни одного импорта в `app/`.
 *
 * Отображатель `toClassCard` ниже остаётся: им пользуются фикстурные разделы,
 * которые ещё не переехали (главная, хаб направления, карточки у инструктора и
 * площадки). Два отображателя одного типа — временное состояние миграции, а не
 * решение: с последним переехавшим разделом фикстурный уходит целиком.
 */
export { getClassDetail, getClassFacets, getClassList } from '../queries/classes';

/**
 * Инструкторы читаются из базы (задача 2.1).
 *
 * `showsAverageRating` переехал вместе с ними: правило «одна оценка по одному
 * отзыву — не оценка» относится к рейтингу, а рейтинг теперь считает слой
 * запросов.
 */
export {
  getInstructorDetail,
  getInstructorFacets,
  getInstructorList,
  instructorSortOptions,
  showsAverageRating,
} from '../queries/instructors';

/** Площадки, события и товары — тоже из базы (задача 2.1). */
export {
  getVenueDetail,
  getVenueFacets,
  getVenueList,
  venueSortOptions,
} from '../queries/venues';
export { eventSortOptions, getEventDetail, getEventList } from '../queries/events';
export {
  getProductCategories,
  getProductDetail,
  getProductList,
  isLowStock,
  productSortOptions,
} from '../queries/products';

/** Направления и слаги каталога — тоже из базы. */
export { getStyleHub, getStyleHubSlugs, getStyleSummaries } from '../queries/styles';
export { getCatalogSlugs } from '../queries/slugs';

export function toClassCard(item: DemoClass): ClassCardItem {
  return {
    slug: item.slug,
    title: item.title,
    style: item.style,
    level: item.level,
    instructorName: instructorBySlug(item.instructorSlug).name,
    weekday: item.weekday,
    startTime: item.startTime,
    durationMinutes: item.durationMinutes,
    price: item.price,
    spotsLeft: item.spotsLeft,
    /** Лист ожидания включается флагом бизнес-правил, а не полем контента. */
    waitlistOpen: booking.waitlistEnabled,
    isTrending: item.isTrending,
    image: mediaRef(item.coverAsset ?? item.asset),
  };
}

export function toInstructorCard(item: DemoInstructor): InstructorCardItem {
  return {
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
  };
}

export function toVenueCard(item: DemoVenue): VenueCardItem {
  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    district: item.district,
    amenities: item.amenities,
    pricePerHour: item.pricePerHour,
    ratingAverage: item.ratingAverage,
    ratingCount: item.ratingCount,
    image: mediaRef(item.asset),
  };
}

export function toEventCard(item: DemoEvent): EventCardItem {
  return {
    slug: item.slug,
    title: item.title,
    type: item.type,
    startsAt: eventDate(item.monthDay).toISOString(),
    startTime: item.startTime,
    endTime: item.endTime,
    /**
     * Площадка платформы или внешнее место. В БД это связь с `Venue` либо
     * свободный адрес: у батла на площади нет площадки в каталоге.
     */
    locationName: item.venueSlug ? venueBySlug(item.venueSlug).name : (item.locationName ?? ''),
    price: item.price,
    spotsLeft: item.spotsLeft,
    image: mediaRef(item.asset),
  };
}

export function toProductCard(item: DemoProduct): ProductCardItem {
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
}

export function toStyleTile(tile: DemoStyleTile): StyleTileItem {
  return {
    style: tile.style,
    slug: danceStyleSlug(tile.style),
    image: mediaRef(tile.asset),
    classCount: tile.classCount,
  };
}

export function toTestimonial(item: DemoReview): TestimonialItem {
  return {
    id: reviewId(item),
    authorName: item.authorName,
    authorRole: item.authorRole,
    rating: item.rating,
    body: item.body,
    image: mediaRef(item.asset),
  };
}

function reviewId(item: DemoReview): string {
  return `${item.targetType}-${item.targetSlug}-${item.authorName}`;
}

function toReview(item: DemoReview): ReviewItem {
  return {
    id: reviewId(item),
    authorName: item.authorName,
    authorRole: item.authorRole,
    rating: item.rating,
    body: item.body,
    /**
     * При `requireVerifiedPurchase` опубликованных отзывов без брони не бывает:
     * флаг выводится из правила, а не хранится в фикстуре, чтобы бейдж исчез
     * вместе с правилом, а не остался неверным.
     */
    isVerifiedPurchase: reviewRules.requireVerifiedPurchase,
    image: mediaRef(item.asset),
  };
}

/**
 * Отзывы фикстур — только для главной (`home.ts`), где блок отзывов ещё не
 * переехал. Настоящие отзывы читает `queries/reviews.ts`.
 */
export function fixtureReviews(): readonly ReviewItem[] {
  return demoReviews.map(toReview);
}

/* ─────────────────────────── Занятия ─────────────────────────── */

/**
 * Ключи сортировки занятия.
 *
 * `relevance` — трендовые сначала, как в подборке главной. `createdAt` подменён
 * позицией в фикстуре: у демо-данных нет времени создания, и выдумывать его хуже,
 * чем честно отсортировать по порядку появления в каталоге. В базе это
 * `DanceClass.createdAt`.
 */
function classSortKeys(now: Date) {
  return {
    relevance: (item: DemoClass) => (item.isTrending ? 0 : 1),
    price: (item: DemoClass) => item.price,
    rating: (item: DemoClass) => instructorBySlug(item.instructorSlug).ratingAverage,
    startsAt: (item: DemoClass) => nextOccurrence(item.weekday, item.startTime, now).getTime(),
    createdAt: (item: DemoClass) => demoClasses.indexOf(item),
  };
}

export const classSortOptions: readonly CatalogSort[] = availableSorts(classSortKeys(new Date()));

/**
 * Цена товара для поиска: минимальная из вариантов.
 *
 * Осталась здесь, пока поиск идёт по фикстурам. Уедет вместе с ним в
 * `queries/search.ts`; в `queries/products.ts` то же правило уже есть.
 */
function productPrice(item: DemoProduct): number {
  const prices = item.variants.map((variant) => variant.price);
  return prices.length > 0 ? Math.min(...prices) : item.price;
}


/* ─────────────────────────── Баннеры разделов ─────────────────────────── */


/**
 * Кадр в баннере раздела.
 *
 * Это контент, а не вёрстка: требование заказчика — все фото управляются из
 * админки, значит «какая фотография открывает раздел „Залы“» обязано быть
 * данными. Сегодня карта, завтра — `ContentBlock` (`docs/07-feature-backlog.md`,
 * A-17), и ни одна страница об этом не узнает.
 */
const listingHeroAssets: Record<ListingSection, string> = {
  discover: 'hero-dancer',
  classes: 'editorial-rhythm',
  instructors: 'hero-loop-poster',
  studios: 'studio-pulse-dance-studio',
  events: 'style-hip-hop',
  shop: 'product-dance-shoes',
};

export function getListingHero(section: ListingSection): MediaRef {
  return mediaRef(listingHeroAssets[section]);
}

/**
 * Кадр в баннере контентной страницы.
 *
 * Отдельная карта, а не расширение `listingHeroAssets`: раздел каталога и
 * контентная страница — разные сущности, и `ListingSection` не должен обрастать
 * значениями, которых нет ни в маршрутах листингов, ни в фильтрах.
 *
 * Страницы без кадра в этой карте отсутствуют намеренно: у справки, вопросов и
 * правовых документов фотографии нет — снимок над оглавлением оферты не
 * помогает её читать.
 */
const contentHeroAssets = {
  about: 'editorial-rhythm',
  becomeInstructor: 'instructor-arman-harutyunyan',
  listYourStudio: 'studio-rhythm-space',
  giftCards: 'product-gift-card',
  /*
   * Перечень направлений. Кадр намеренно не привязан ни к одному из них:
   * фотография хип-хопа над списком, где хип-хоп — одна строка из восемнадцати,
   * читалась бы как заголовок раздела о хип-хопе.
   */
  styles: 'editorial-loop-poster',
} as const;

export type ContentHeroKey = keyof typeof contentHeroAssets;

export function getContentHero(key: ContentHeroKey): MediaRef {
  return mediaRef(contentHeroAssets[key]);
}

/* ─────────────────────────── Поиск ─────────────────────────── */

/**
 * Поиск по каталогу.
 *
 * Три решения, каждое из которых закрывает конкретный способ не найти нужное:
 *
 * 1. **Сравнение по ключу поиска**, а не по строке (`matchesQuery` →
 *    `searchKey`): «Բաչատա», «bachata», «бачата» и «бочата» — один запрос.
 * 2. **Совпадение по направлению**, а не только по тексту: запрос «сальса»
 *    находит «Latin Fusion Night», потому что это занятие по сальсе, хотя слова
 *    «сальса» в названии нет. Словарь написаний — `danceStylesMatchingTerm`.
 * 3. **Порядок по качеству совпадения**: попадание в название выше, чем в
 *    описание, а оно выше, чем «то же направление». Иначе первым в выдаче
 *    оказывается то, что просто раньше лежит в базе.
 *
 * Выключенный модуль в поиск не попадает: ссылка на товар при `features.shop =
 * false` ведёт в раздел, которого на сайте нет.
 *
 * В production запрос уйдёт в полнотекстовый индекс PostgreSQL; подпись функции
 * и форма результата не изменятся — изменится только то, где считается ключ.
 */
export function searchCatalog(
  term: string,
  scope: SearchScope,
  limit: number,
): readonly SearchHit[] {
  const wants = (candidate: SearchHitScope): boolean =>
    (scope === 'all' || scope === candidate) && isSearchScopeEnabled(candidate);

  /** Направления, которые человек мог иметь в виду: «хип-хоп», «hiphop», «Հիփ-հոփ». */
  const styles = danceStylesMatchingTerm(term);
  const styleMatched = (style: DanceStyle): boolean => styles.includes(style);

  const scored: Array<{ hit: SearchHit; rank: number }> = [];

  const add = (hit: SearchHit, rank: number): void => {
    scored.push({ hit, rank });
  };

  /**
   * Насколько хорошо результат отвечает запросу.
   *
   * Меньше — выше. `null` означает «не отвечает вовсе»: такой результат в выдачу
   * не попадает.
   */
  const rankOf = (title: string, otherFields: ReadonlyArray<string | undefined>, byStyle: boolean): number | null => {
    if (matchesQuery(term, [title])) return 0;
    if (matchesQuery(term, otherFields)) return 1;
    return byStyle ? 2 : null;
  };

  if (wants('classes')) {
    for (const item of demoClasses) {
      const instructor = instructorBySlug(item.instructorSlug);
      const venue = venueBySlug(item.venueSlug);
      const rank = rankOf(
        item.title,
        [instructor.name, venue.name, venue.district, item.description, ...item.learningPoints],
        styleMatched(item.style),
      );
      if (rank === null) continue;

      add(
        {
          id: `class-${item.slug}`,
          scope: 'classes',
          title: item.title,
          subtitle: instructor.name,
          href: routes.class(item.slug),
          image: item.coverAsset ?? item.asset,
          price: item.price,
        },
        rank,
      );
    }
  }

  if (wants('instructors')) {
    for (const item of demoInstructors) {
      const rank = rankOf(
        item.name,
        [item.headline, item.bio, ...item.specializations],
        item.styles.some(styleMatched),
      );
      if (rank === null) continue;

      add(
        {
          id: `instructor-${item.slug}`,
          scope: 'instructors',
          title: item.name,
          subtitle: item.headline,
          href: routes.instructor(item.slug),
          image: item.asset,
          price: item.hourlyRateFrom,
        },
        rank,
      );
    }
  }

  if (wants('studios')) {
    for (const item of demoVenues) {
      /* Зал отвечает запросу о направлении, если здесь ему учат. */
      const teachesStyle = demoClasses.some(
        (entry) => entry.venueSlug === item.slug && styleMatched(entry.style),
      );
      const rank = rankOf(
        item.name,
        [item.description, item.district, ...item.amenities],
        teachesStyle,
      );
      if (rank === null) continue;

      add(
        {
          id: `venue-${item.slug}`,
          scope: 'studios',
          title: item.name,
          subtitle: item.district,
          href: routes.studio(item.slug),
          image: item.asset,
          price: item.pricePerHour,
        },
        rank,
      );
    }
  }

  if (wants('events')) {
    for (const item of demoEvents) {
      const venueName = item.venueSlug ? venueBySlug(item.venueSlug).name : undefined;
      const rank = rankOf(item.title, [item.description, item.locationName, venueName], false);
      if (rank === null) continue;

      add(
        {
          id: `event-${item.slug}`,
          scope: 'events',
          title: item.title,
          subtitle: venueName ?? item.locationName ?? '',
          href: routes.event(item.slug),
          image: item.asset,
          price: item.price,
        },
        rank,
      );
    }
  }

  if (wants('products')) {
    for (const item of demoProducts) {
      const rank = rankOf(item.title, [item.description, item.brand], false);
      if (rank === null) continue;

      add(
        {
          id: `product-${item.slug}`,
          scope: 'products',
          title: item.title,
          subtitle: item.brand,
          href: routes.product(item.slug),
          image: item.asset,
          price: productPrice(item),
        },
        rank,
      );
    }
  }

  /*
   * Сортировка стабильная: при равном качестве совпадения сохраняется порядок
   * разделов и порядок каталога внутри раздела. Нестабильная перемешивала бы
   * выдачу между одинаковыми запросами — и один и тот же результат оказывался бы
   * то первым, то пятым.
   */
  return scored
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.hit);
}

/**
 * Пустая страница результатов нужного типа.
 *
 * Реэкспорт, чтобы страницы каталога не импортировали домен ради одной функции:
 * весь контент они берут из этого модуля.
 */
export { emptyCatalogPage };
