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
  demoProductCategories,
  demoProducts,
  demoReviews,
  demoStyleTiles,
  demoVenues,
  type DemoClass,
  type DemoEvent,
  type DemoInstructor,
  type DemoProduct,
  type DemoReview,
  type DemoVenue,
} from '../../../prisma/fixtures/demo';
import { booking, commerce, limits, reviews as reviewRules } from '@/config/business';
import { routes, type ListingSection } from '@/config/routes';
import {
  availableSorts,
  buildFacets,
  matchesQuery,
  paginate,
  sortByOption,
  type CatalogQuery,
  type CatalogSort,
} from '@/domain/catalog';
import {
  emptyCatalogPage,
  type CatalogPage,
  type ClassCardItem,
  type ClassDetail,
  type EventCardItem,
  type EventDetail,
  type FacetOption,
  type InstructorCardItem,
  type InstructorDetail,
  type MediaRef,
  type ProductCardItem,
  type ProductDetail,
  type RatingSummary,
  type ReviewItem,
  type ScheduleEntry,
  type StyleHubDetail,
  type StyleSummary,
  type StyleTileItem,
  type TestimonialItem,
  type VenueCardItem,
  type VenueDetail,
} from '@/domain/content';
import {
  danceStyleFromSlug,
  danceStyleLabelKey,
  danceStyleSlug,
  danceStyles,
  danceStylesMatchingTerm,
  relatedDanceStyles,
  skillLevelLabelKey,
  skillLevels,
  type DanceStyle,
} from '@/domain/enums';
import {
  isSearchScopeEnabled,
  type SearchHit,
  type SearchHitScope,
  type SearchScope,
} from '@/domain/search';
import { shiftClock } from '@/lib/time/clock';
import { isoDateFallsOnWeekday, nextOccurrence } from '@/lib/time/schedule';

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
    startsAt: eventDate(item.monthDay),
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

export function toStyleTile(tile: (typeof demoStyleTiles)[number]): StyleTileItem {
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
 * Отзывы о сущности и агрегат рейтинга.
 *
 * Для инструктора среднее и число берутся из его профиля (в базе это
 * денормализованные `ratingAverage`/`ratingCount`, которые пересчитываются при
 * публикации отзыва), а список — из самих отзывов. Это не рассинхрон, а разные
 * вопросы: «какая у него оценка» и «что именно писали».
 */
function reviewsFor(
  targetType: DemoReview['targetType'],
  targetSlug: string,
  known?: { average: number; count: number },
): { rating: RatingSummary; items: readonly ReviewItem[] } {
  const matching = demoReviews.filter(
    (item) => item.targetType === targetType && item.targetSlug === targetSlug,
  );

  if (known) {
    return { rating: { average: known.average, count: known.count }, items: matching.map(toReview) };
  }

  const count = matching.length;
  const average =
    count === 0 ? 0 : matching.reduce((sum, item) => sum + item.rating, 0) / count;

  return { rating: { average, count }, items: matching.map(toReview) };
}

/** Показывать ли среднюю оценку. Одна оценка по одному отзыву — не оценка. */
export function showsAverageRating(rating: RatingSummary): boolean {
  return rating.count >= reviewRules.minCountToDisplayAverage;
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

function matchesClassFilters(item: DemoClass, query: CatalogQuery): boolean {
  if (query.style && item.style !== query.style) return false;
  /**
   * `ALL_LEVELS` подходит любому запросу об уровне: занятие «для всех уровней»
   * действительно подходит начинающему, и прятать его от фильтра «beginner»
   * означало бы скрывать самое подходящее.
   */
  if (query.level && item.level !== query.level && item.level !== 'ALL_LEVELS') return false;
  if (query.district && venueBySlug(item.venueSlug).district !== query.district) return false;
  if (query.date && !isoDateFallsOnWeekday(query.date, item.weekday)) return false;
  if (query.priceMin !== undefined && item.price < query.priceMin) return false;
  if (query.priceMax !== undefined && item.price > query.priceMax) return false;

  return matchesQuery(query.q, [
    item.title,
    item.description,
    instructorBySlug(item.instructorSlug).name,
    venueBySlug(item.venueSlug).name,
    venueBySlug(item.venueSlug).district,
    ...item.learningPoints,
  ]);
}

export function getClassList(query: CatalogQuery, now: Date = new Date()): CatalogPage<ClassCardItem> {
  const filtered = demoClasses.filter((item) => matchesClassFilters(item, query));
  const sorted = sortByOption(filtered, query.sort, classSortKeys(now));
  const page = paginate(sorted, query.page, query.pageSize);

  return { ...page, items: page.items.map(toClassCard) };
}

/** Расписание занятия. В фикстурах — одна строка правила, в базе — `ClassSession`. */
function scheduleFor(item: DemoClass): readonly ScheduleEntry[] {
  return [
    {
      weekday: item.weekday,
      startTime: item.startTime,
      endTime: shiftClock(item.startTime, item.durationMinutes),
      spotsLeft: item.spotsLeft,
    },
  ];
}

export function getClassDetail(slug: string): ClassDetail | null {
  const item = demoClasses.find((entry) => entry.slug === slug);
  if (!item) return null;

  const instructor = instructorBySlug(item.instructorSlug);
  const venue = venueBySlug(item.venueSlug);
  const { rating, items: reviewItems } = reviewsFor('class', slug);

  return {
    ...toClassCard(item),
    description: item.description,
    learningPoints: item.learningPoints,
    capacity: item.capacity,
    instructorSlug: instructor.slug,
    instructorHeadline: instructor.headline,
    instructorImage: mediaRef(instructor.asset),
    instructorRating: instructor.ratingAverage,
    instructorRatingCount: instructor.ratingCount,
    instructorVerified: instructor.isVerified,
    venueSlug: venue.slug,
    venueName: venue.name,
    venueDistrict: venue.district,
    schedule: scheduleFor(item),
    rating,
    reviews: reviewItems,
    /** Похожие: то же направление, кроме самого занятия. */
    similar: demoClasses
      .filter((entry) => entry.slug !== slug && entry.style === item.style)
      .map(toClassCard),
  };
}

/* ─────────────────────────── Инструкторы ─────────────────────────── */

function instructorSortKeys() {
  return {
    /** Проверенные и с более высокой оценкой — выше. */
    relevance: (item: DemoInstructor) => (item.isVerified ? 0 : 1) * 10 - item.ratingAverage,
    price: (item: DemoInstructor) => item.hourlyRateFrom,
    rating: (item: DemoInstructor) => item.ratingAverage,
    createdAt: (item: DemoInstructor) => demoInstructors.indexOf(item),
  };
}

export const instructorSortOptions: readonly CatalogSort[] = availableSorts(instructorSortKeys());

/** Площадки, на которых инструктор ведёт занятия. В базе — через `DanceClass`. */
function venuesOf(instructorSlug: string): readonly DemoVenue[] {
  const slugs = new Set(
    demoClasses.filter((item) => item.instructorSlug === instructorSlug).map((item) => item.venueSlug),
  );
  return [...slugs].map(venueBySlug);
}

function matchesInstructorFilters(item: DemoInstructor, query: CatalogQuery): boolean {
  if (query.style && !item.styles.includes(query.style)) return false;
  if (query.district && !venuesOf(item.slug).some((venue) => venue.district === query.district)) {
    return false;
  }
  if (query.priceMin !== undefined && item.hourlyRateFrom < query.priceMin) return false;
  if (query.priceMax !== undefined && item.hourlyRateFrom > query.priceMax) return false;

  return matchesQuery(query.q, [
    item.name,
    item.headline,
    item.bio,
    ...item.specializations,
    ...item.styles,
  ]);
}

export function getInstructorList(query: CatalogQuery): CatalogPage<InstructorCardItem> {
  const filtered = demoInstructors.filter((item) => matchesInstructorFilters(item, query));
  const sorted = sortByOption(filtered, query.sort, instructorSortKeys());
  const page = paginate(sorted, query.page, query.pageSize);

  return { ...page, items: page.items.map(toInstructorCard) };
}

export function getInstructorDetail(slug: string): InstructorDetail | null {
  const item = demoInstructors.find((entry) => entry.slug === slug);
  if (!item) return null;

  const { rating, items: reviewItems } = reviewsFor('instructor', slug, {
    average: item.ratingAverage,
    count: item.ratingCount,
  });

  return {
    ...toInstructorCard(item),
    bio: item.bio,
    specializations: item.specializations,
    studentCount: item.studentCount,
    acceptsTravel: item.acceptsTravel,
    experience: (item.experience ?? []).map((entry) => ({
      title: entry.title,
      ...(entry.organization ? { organization: entry.organization } : {}),
      ...(entry.location ? { location: entry.location } : {}),
      startYear: entry.startYear,
      ...(entry.endYear ? { endYear: entry.endYear } : {}),
    })),
    classes: demoClasses.filter((entry) => entry.instructorSlug === slug).map(toClassCard),
    venues: venuesOf(slug).map((venue) => ({ slug: venue.slug, name: venue.name })),
    rating,
    reviews: reviewItems,
  };
}

/* ─────────────────────────── Площадки ─────────────────────────── */

function venueSortKeys() {
  return {
    relevance: (item: DemoVenue) => -item.ratingAverage,
    price: (item: DemoVenue) => item.pricePerHour,
    rating: (item: DemoVenue) => item.ratingAverage,
    createdAt: (item: DemoVenue) => demoVenues.indexOf(item),
  };
}

export const venueSortOptions: readonly CatalogSort[] = availableSorts(venueSortKeys());

function matchesVenueFilters(item: DemoVenue, query: CatalogQuery): boolean {
  if (query.district && item.district !== query.district) return false;
  if (query.priceMin !== undefined && item.pricePerHour < query.priceMin) return false;
  if (query.priceMax !== undefined && item.pricePerHour > query.priceMax) return false;
  /**
   * Фильтр по направлению у площадки означает «здесь этому учат»: у зала своего
   * направления нет, но выбирать зал под сальсу — осмысленно.
   */
  if (
    query.style &&
    !demoClasses.some((entry) => entry.venueSlug === item.slug && entry.style === query.style)
  ) {
    return false;
  }

  return matchesQuery(query.q, [item.name, item.description, item.district, ...item.amenities]);
}

export function getVenueList(query: CatalogQuery): CatalogPage<VenueCardItem> {
  const filtered = demoVenues.filter((item) => matchesVenueFilters(item, query));
  const sorted = sortByOption(filtered, query.sort, venueSortKeys());
  const page = paginate(sorted, query.page, query.pageSize);

  return { ...page, items: page.items.map(toVenueCard) };
}

export function getVenueDetail(slug: string): VenueDetail | null {
  const item = demoVenues.find((entry) => entry.slug === slug);
  if (!item) return null;

  const { rating, items: reviewItems } = reviewsFor('class', slug, {
    average: item.ratingAverage,
    count: item.ratingCount,
  });

  return {
    ...toVenueCard(item),
    areaSqm: item.areaSqm,
    capacity: item.capacity,
    latitude: item.latitude,
    longitude: item.longitude,
    classes: demoClasses.filter((entry) => entry.venueSlug === slug).map(toClassCard),
    events: demoEvents.filter((entry) => entry.venueSlug === slug).map(toEventCard),
    rating,
    reviews: reviewItems,
  };
}

/* ─────────────────────────── События ─────────────────────────── */

function eventSortKeys(now: Date) {
  return {
    /** Ближайшее сначала: афиша без этого порядка бесполезна. */
    relevance: (item: DemoEvent) => eventDate(item.monthDay, now).getTime(),
    price: (item: DemoEvent) => item.price,
    startsAt: (item: DemoEvent) => eventDate(item.monthDay, now).getTime(),
    createdAt: (item: DemoEvent) => demoEvents.indexOf(item),
  };
}

export const eventSortOptions: readonly CatalogSort[] = availableSorts(eventSortKeys(new Date()));

function matchesEventFilters(item: DemoEvent, query: CatalogQuery, now: Date): boolean {
  if (query.priceMin !== undefined && item.price < query.priceMin) return false;
  if (query.priceMax !== undefined && item.price > query.priceMax) return false;
  if (query.district) {
    const district = item.venueSlug ? venueBySlug(item.venueSlug).district : undefined;
    if (district !== query.district) return false;
  }
  if (query.date && eventDate(item.monthDay, now).toISOString().slice(0, 10) !== query.date) {
    return false;
  }

  return matchesQuery(query.q, [
    item.title,
    item.description,
    item.locationName,
    item.venueSlug ? venueBySlug(item.venueSlug).name : undefined,
  ]);
}

export function getEventList(query: CatalogQuery, now: Date = new Date()): CatalogPage<EventCardItem> {
  const filtered = demoEvents.filter((item) => matchesEventFilters(item, query, now));
  const sorted = sortByOption(filtered, query.sort, eventSortKeys(now));
  const page = paginate(sorted, query.page, query.pageSize);

  return { ...page, items: page.items.map(toEventCard) };
}

export function getEventDetail(slug: string): EventDetail | null {
  const item = demoEvents.find((entry) => entry.slug === slug);
  if (!item) return null;

  const venue = item.venueSlug ? venueBySlug(item.venueSlug) : undefined;

  return {
    ...toEventCard(item),
    description: item.description,
    capacity: item.capacity,
    ...(venue
      ? {
          venueSlug: venue.slug,
          venueDistrict: venue.district,
          latitude: venue.latitude,
          longitude: venue.longitude,
        }
      : {}),
  };
}

/* ─────────────────────────── Товары ─────────────────────────── */

function productPrice(item: DemoProduct): number {
  const prices = item.variants.map((variant) => variant.price);
  return prices.length > 0 ? Math.min(...prices) : item.price;
}

function productSortKeys() {
  return {
    /** В наличии — выше: товар, который нельзя купить, не должен открывать список. */
    relevance: (item: DemoProduct) => (totalStock(item) > 0 ? 0 : 1),
    price: productPrice,
    createdAt: (item: DemoProduct) => demoProducts.indexOf(item),
  };
}

function totalStock(item: DemoProduct): number {
  return item.variants.reduce((sum, variant) => sum + variant.stock, 0);
}

export const productSortOptions: readonly CatalogSort[] = availableSorts(productSortKeys());

function matchesProductFilters(item: DemoProduct, query: CatalogQuery): boolean {
  if (query.category && item.category !== query.category) return false;
  if (query.priceMin !== undefined && productPrice(item) < query.priceMin) return false;
  if (query.priceMax !== undefined && productPrice(item) > query.priceMax) return false;

  return matchesQuery(query.q, [
    item.title,
    item.description,
    item.brand,
    ...item.variants.flatMap((variant) => [variant.size, variant.color]),
  ]);
}

export function getProductList(query: CatalogQuery): CatalogPage<ProductCardItem> {
  const filtered = demoProducts.filter((item) => matchesProductFilters(item, query));
  const sorted = sortByOption(filtered, query.sort, productSortKeys());
  const page = paginate(sorted, query.page, query.pageSize);

  return { ...page, items: page.items.map(toProductCard) };
}

export function getProductDetail(slug: string): ProductDetail | null {
  const item = demoProducts.find((entry) => entry.slug === slug);
  if (!item) return null;

  return {
    ...toProductCard(item),
    description: item.description,
    categorySlug: item.category,
    variants: item.variants.map((variant) => ({
      sku: variant.sku,
      ...(variant.size ? { size: variant.size } : {}),
      ...(variant.color ? { color: variant.color } : {}),
      price: variant.price,
      stock: variant.stock,
    })),
    /**
     * Галерея. В фикстурах у товара один кадр, поэтому и в галерее он один —
     * дублировать его до «трёх фотографий» ради красивой полосы миниатюр значило
     * бы показать заказчику то, чего в его данных нет. В production кадры
     * приходят из `MediaAsset`, и компонент готов к любому их числу.
     */
    gallery: [mediaRef(item.asset)],
    isGiftCard: item.isGiftCard === true,
    related: demoProducts
      .filter((entry) => entry.slug !== slug && entry.category === item.category)
      .map(toProductCard),
  };
}

/** Товар, у которого остаток ниже порога: определяет метку «осталось мало». */
export function isLowStock(stock: number): boolean {
  return stock > 0 && stock <= commerce.lowStockThreshold;
}

export function getProductCategories(): readonly FacetOption[] {
  return demoProductCategories
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((category) => ({
      value: category.slug,
      /**
       * Категории — контент заказчика, а не словарь домена: их названия приходят
       * из `ProductCategoryTranslation`, а не из каталога переводов интерфейса.
       * Поэтому здесь имя из данных, а не ключ i18n.
       */
      labelKey: category.name,
      count: demoProducts.filter((item) => item.category === category.slug).length,
    }));
}

/* ─────────────────────────── Фасеты фильтров ─────────────────────────── */

/**
 * Фасеты считаются по полному набору, а не по отфильтрованному.
 *
 * Иначе выбор направления «сальса» обнуляет счётчики всех остальных, и вернуться
 * к «хип-хопу» становится некуда: фильтр, который прячет сам себя после
 * применения, — распространённая ошибка каталогов.
 */
export function getClassFacets(): {
  styles: readonly FacetOption[];
  levels: readonly FacetOption[];
  districts: readonly FacetOption[];
  priceRange: { min: number; max: number };
} {
  const prices = demoClasses.map((item) => item.price);

  return {
    styles: buildFacets(
      demoClasses,
      (item) => [danceStyleSlug(item.style)],
      (value) => danceStyleLabelKey(styleFromSlugStrict(value)),
    ),
    levels: buildFacets(
      demoClasses,
      (item) => [item.level],
      (value) => skillLevelLabelKey(value as never),
    ),
    districts: buildFacets(
      demoClasses,
      (item) => [venueBySlug(item.venueSlug).district],
      /** Район — данные, а не словарь: подпись берётся как есть. */
      (value) => value,
    ),
    priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
  };
}

export function getInstructorFacets(): {
  styles: readonly FacetOption[];
  districts: readonly FacetOption[];
  priceRange: { min: number; max: number };
} {
  const prices = demoInstructors.map((item) => item.hourlyRateFrom);

  return {
    styles: buildFacets(
      demoInstructors,
      (item) => item.styles.map(danceStyleSlug),
      (value) => danceStyleLabelKey(styleFromSlugStrict(value)),
    ),
    districts: buildFacets(
      demoInstructors,
      (item) => venuesOf(item.slug).map((venue) => venue.district),
      (value) => value,
    ),
    priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
  };
}

export function getVenueFacets(): {
  districts: readonly FacetOption[];
  priceRange: { min: number; max: number };
} {
  const prices = demoVenues.map((item) => item.pricePerHour);

  return {
    districts: buildFacets(
      demoVenues,
      (item) => [item.district],
      (value) => value,
    ),
    priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
  };
}

/** Слаг направления обратно в enum. Данные наши, поэтому расхождение — ошибка. */
function styleFromSlugStrict(slug: string): DanceStyle {
  const style = demoStyleTiles.find((tile) => danceStyleSlug(tile.style) === slug)?.style;
  if (style) return style;

  const fromClasses = demoClasses.find((item) => danceStyleSlug(item.style) === slug)?.style;
  if (fromClasses) return fromClasses;

  const fromInstructors = demoInstructors
    .flatMap((item) => item.styles)
    .find((value) => danceStyleSlug(value) === slug);
  if (fromInstructors) return fromInstructors;

  throw new Error(`[catalog] Слаг направления «${slug}» не встречается в данных.`);
}

/* ─────────────────────────── Направления ───────────────────────────
 *
 * Хаб направления (`/styles/[style]`) собирается из того же каталога, что и
 * листинги, но отвечает на другой вопрос. Листинг отвечает «какие занятия
 * подходят под фильтры», хаб — «что такое сальса, кто её ведёт в Ереване, где и
 * сколько это стоит». Поэтому здесь не `CatalogPage`, а сводка.
 *
 * Счётчики считаются по данным, а не берутся из фикстуры, и это существенно:
 * `demoStyleTiles.classCount` — числа из макета (48 занятий по хип-хопу),
 * контент прототипа, который заказчик утвердил для главной. Хаб же ПОКАЗЫВАЕТ
 * занятия рядом со счётчиком, и «48» над одной карточкой — не украшение, а
 * ошибка. В production оба числа считаются из базы и сходятся; в демо-данных
 * плитка главной остаётся макетной, а хаб честен.
 */

/** Кадр направления. Фотография есть у пяти направлений макета, у остальных — нет. */
function styleAsset(style: DanceStyle): string | null {
  const tile = demoStyleTiles.find((entry) => entry.style === style);
  if (tile) return tile.asset;

  /*
   * Запасной вариант — обложка занятия по этому направлению: если хип-хоп ведут,
   * кадр с занятия честно показывает именно его. Придумывать соответствие
   * «фламенко → любая фотография» нельзя: снимок другого танца хуже отсутствия
   * снимка, потому что он утверждает неправду.
   */
  const item = demoClasses.find((entry) => entry.style === style);
  return item ? (item.coverAsset ?? item.asset) : null;
}

function classesOfStyle(style: DanceStyle): readonly DemoClass[] {
  return demoClasses.filter((item) => item.style === style);
}

function instructorsOfStyle(style: DanceStyle): readonly DemoInstructor[] {
  return demoInstructors.filter((item) => item.styles.includes(style));
}

function toStyleSummary(style: DanceStyle): StyleSummary {
  const asset = styleAsset(style);

  return {
    style,
    slug: danceStyleSlug(style),
    image: asset === null ? null : mediaRef(asset),
    classCount: classesOfStyle(style).length,
    instructorCount: instructorsOfStyle(style).length,
  };
}

/** Все направления в порядке `danceStyles` — для перечня на `/styles`. */
export function getStyleSummaries(): readonly StyleSummary[] {
  return danceStyles.map(toStyleSummary);
}

/**
 * Сводка по направлению или `null`, если слаг неизвестен.
 *
 * `null` вместо исключения: слаг приходит из URL, то есть от кого угодно, и
 * `/styles/tap-dance` — это 404, а не сломанные данные.
 */
export function getStyleHub(slug: string): StyleHubDetail | null {
  const style = danceStyleFromSlug(slug);
  if (!style) return null;

  const classes = classesOfStyle(style);
  const prices = classes.map((item) => item.price);

  /* Залы: те, где по этому направлению есть занятия. Порядок каталога сохраняется. */
  const venueSlugs = new Set(classes.map((item) => item.venueSlug));

  return {
    ...toStyleSummary(style),
    classes: classes.slice(0, limits.styleHub.classes).map(toClassCard),
    instructors: instructorsOfStyle(style).slice(0, limits.styleHub.instructors).map(toInstructorCard),
    venues: demoVenues
      .filter((venue) => venueSlugs.has(venue.slug))
      .slice(0, limits.styleHub.venues)
      .map(toVenueCard),
    priceFrom: prices.length > 0 ? Math.min(...prices) : null,
    /* Порядок уровней — как в словаре, а не как в данных: «начальный» перед «средним». */
    levels: skillLevels.filter((level) => classes.some((item) => item.level === level)),
    districts: [...new Set(classes.map((item) => venueBySlug(item.venueSlug).district))],
    related: relatedDanceStyles(style).map(toStyleSummary),
  };
}

/**
 * Направления, у которых есть что показать: занятие или преподаватель.
 *
 * Только они попадают в карту сайта и в индекс. Хаб без предложения остаётся
 * доступным по адресу — у него есть описание направления и соседние направления,
 * — но приглашать поисковик на «уроки фламенко в Ереване», которых нет, значит
 * обещать несуществующее и получить отказ на первом же переходе.
 */
export function getStyleHubSlugs(): readonly string[] {
  return danceStyles
    .filter((style) => classesOfStyle(style).length > 0 || instructorsOfStyle(style).length > 0)
    .map(danceStyleSlug);
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

/* ─────────────────────────── Слаги для SSG и sitemap ─────────────────────────── */

/**
 * Все слаги каталога.
 *
 * Используется `generateStaticParams` и `sitemap.ts`. Один источник на оба:
 * страница, статически собранная, но не попавшая в карту сайта, — это оплаченная
 * сборка, которую никто не найдёт.
 */
export function getCatalogSlugs(): {
  classes: readonly string[];
  instructors: readonly string[];
  venues: readonly string[];
  events: readonly string[];
  products: readonly string[];
} {
  return {
    classes: demoClasses.map((item) => item.slug),
    instructors: demoInstructors.map((item) => item.slug),
    venues: demoVenues.map((item) => item.slug),
    events: demoEvents.map((item) => item.slug),
    products: demoProducts.map((item) => item.slug),
  };
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
