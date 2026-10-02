/**
 * CMS-КОНТРАКТ ГЛАВНОЙ.
 *
 * ContentBlock хранит только презентацию и кураторский порядок. Названия кнопок
 * и секций остаются в i18n, а цены, остатки, публичность и счётчики приходят из
 * таблиц каталога. Так CMS не становится вторым источником бизнес-данных.
 */

import { z } from 'zod';

import { danceStyles } from '@/domain/enums';

export const homeStatIds = [
  'activeDancers',
  'instructors',
  'styles',
  'rating',
] as const;

export const homeContentConfig = {
  blockKey: 'home',
  blockTitle: 'Homepage configuration',
  maxStats: 8,
  maxStyleTiles: 12,
  maxCollectionItems: 12,
  maxStorageKeyLength: 1_024,
  maxSuffixLength: 4,
  maxDecimals: 2,
} as const;

const unique = <T>(items: readonly T[]): boolean => new Set(items).size === items.length;
const storageKey = z.string().trim().min(1).max(homeContentConfig.maxStorageKeyLength);
const orderedSlugs = z
  .array(z.string().trim().min(1).max(160))
  .max(homeContentConfig.maxCollectionItems)
  .refine(unique);

export const homeContentBlockSchema = z.object({
  stats: z
    .array(
      z.object({
        id: z.enum(homeStatIds),
        value: z.number().nonnegative().finite(),
        suffix: z.string().max(homeContentConfig.maxSuffixLength),
        decimals: z.number().int().min(0).max(homeContentConfig.maxDecimals),
      }),
    )
    .min(1)
    .max(homeContentConfig.maxStats)
    .refine((items) => unique(items.map((item) => item.id))),
  media: z.object({
    heroPosterStorageKey: storageKey,
    editorialPosterStorageKey: storageKey,
    competitionPosterStorageKey: storageKey,
  }),
  styleTiles: z
    .array(
      z.object({
        style: z.enum(danceStyles),
        mediaStorageKey: storageKey,
      }),
    )
    .min(1)
    .max(homeContentConfig.maxStyleTiles)
    .refine((items) => unique(items.map((item) => item.style))),
  collections: z.object({
    popularClassSlugs: orderedSlugs,
    instructorSlugs: orderedSlugs,
    venueSlugs: orderedSlugs,
    productSlugs: orderedSlugs,
    eventSlugs: orderedSlugs,
    testimonialAuthorEmails: z
      .array(z.email())
      .max(homeContentConfig.maxCollectionItems)
      .refine(unique),
  }),
});

export type HomeContentBlock = z.infer<typeof homeContentBlockSchema>;

/** JSON из БД валидируется до любого запроса по его ссылкам. */
export function parseHomeContentBlock(body: string): HomeContentBlock {
  return homeContentBlockSchema.parse(JSON.parse(body) as unknown);
}
