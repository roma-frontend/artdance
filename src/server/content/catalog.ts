/** Совместимый фасад публичного каталога и баннеров разделов. */
import 'server-only';

import type { ListingSection } from '@/config/routes';
import { mediaRef } from './media';

export { getClassDetail, getClassFacets, getClassList, classSortOptions } from '../queries/classes';
export {
  getInstructorDetail, getInstructorFacets, getInstructorList,
  instructorSortOptions, showsAverageRating,
} from '../queries/instructors';
export { getVenueDetail, getVenueFacets, getVenueList, venueSortOptions } from '../queries/venues';
export { eventSortOptions, getEventDetail, getEventList } from '../queries/events';
export {
  getProductCategories, getProductDetail, getProductList, isLowStock, productSortOptions,
} from '../queries/products';
export { getStyleHub, getStyleHubSlugs, getStyleSummaries } from '../queries/styles';
export { getCatalogSlugs } from '../queries/slugs';
export { searchCatalog } from '../queries/search';
export { emptyCatalogPage } from '@/domain/content';

/** Выбор кадра пока фиксирован; описания и параметры медиа читаются из БД. */
const listingHeroAssets: Record<ListingSection, string> = {
  discover: 'hero-dancer',
  classes: 'editorial-rhythm',
  instructors: 'hero-loop-poster',
  studios: 'studio-pulse-dance-studio',
  events: 'style-hip-hop',
  shop: 'product-dance-shoes',
};
const dancesportHeroAssets = {
  competitions: 'style-ballroom',
  socialEvents: 'style-salsa',
  athletes: 'instructor-anna-mkrtchyan',
  federations: 'style-ballroom',
  partners: 'studio-rhythm-space',
  sponsors: 'product-gift-card',
  advertise: 'studio-flow-studio',
} as const;
const contentHeroAssets = {
  about: 'editorial-rhythm',
  becomeInstructor: 'instructor-arman-harutyunyan',
  listYourStudio: 'studio-rhythm-space',
  giftCards: 'product-gift-card',
  styles: 'editorial-loop-poster',
} as const;

export type DancesportHeroKey = keyof typeof dancesportHeroAssets;
export type ContentHeroKey = keyof typeof contentHeroAssets;

export function getListingHero(section: ListingSection) {
  return mediaRef(listingHeroAssets[section]);
}
export function getDancesportHero(key: DancesportHeroKey) {
  return mediaRef(dancesportHeroAssets[key]);
}
export function getContentHero(key: ContentHeroKey) {
  return mediaRef(contentHeroAssets[key]);
}
