import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { homeContentConfig } from '@/config/home-content';
import { emptyMediaRef } from '@/domain/content';

import { getHomePageContent } from './home';

const mocks = vi.hoisted(() => ({
  contentBlockFindUnique: vi.fn(),
  mediaFindMany: vi.fn(),
  collectionFindMany: vi.fn(),
  getStyleSummaries: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: {
  contentBlock: { findUnique: mocks.contentBlockFindUnique },
  mediaAsset: { findMany: mocks.mediaFindMany },
  danceClass: { findMany: mocks.collectionFindMany },
  instructorProfile: { findMany: mocks.collectionFindMany },
  venue: { findMany: mocks.collectionFindMany },
  product: { findMany: mocks.collectionFindMany },
  event: { findMany: mocks.collectionFindMany },
  review: { findMany: mocks.collectionFindMany },
} }));
vi.mock('@/server/query', () => ({ defineQuery: (config: { handler: unknown }) => config.handler }));
vi.mock('./styles', () => ({ getStyleSummaries: mocks.getStyleSummaries }));

const hipHopCover = { key: 'https://cdn.example.com/hip-hop.jpg', alt: { hy: 'Hip-hop', ru: 'Hip-hop', en: 'Hip-hop' } };
const summaries = [
  { style: 'SALSA', slug: 'salsa', image: null, classCount: 0, instructorCount: 0 },
  { style: 'HIP_HOP', slug: 'hip-hop', image: hipHopCover, classCount: 4, instructorCount: 2 },
];

const activeBody = JSON.stringify({
  stats: [{ id: 'instructors', value: 40, suffix: '+', decimals: 0 }],
  media: {
    heroPosterStorageKey: 'home/hero.jpg',
    editorialPosterStorageKey: 'home/editorial.jpg',
    competitionPosterStorageKey: 'home/competition.jpg',
  },
  styleTiles: [{ style: 'KIDS', mediaStorageKey: 'home/kids.jpg' }],
  collections: {
    popularClassSlugs: [],
    instructorSlugs: [],
    venueSlugs: [],
    productSlugs: [],
    eventSlugs: [],
    testimonialAuthorEmails: [],
  },
});

const fallbackWarning = '[home] content block missing or inactive, serving code fallback';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStyleSummaries.mockResolvedValue(summaries);
  mocks.mediaFindMany.mockResolvedValue([]);
  mocks.collectionFindMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('home content without a published block', () => {
  it('serves a code fallback instead of throwing when the block is missing', async () => {
    mocks.contentBlockFindUnique.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const content = await getHomePageContent('ru');

    expect(content.hero).toEqual({ video: null, image: emptyMediaRef, stats: [] });
    expect(content.editorial.image).toEqual(emptyMediaRef);
    expect(content.competition.image).toEqual(emptyMediaRef);
    expect(content.styleTiles).toEqual([
      { style: 'HIP_HOP', slug: 'hip-hop', image: hipHopCover, classCount: 4 },
      { style: 'SALSA', slug: 'salsa', image: emptyMediaRef, classCount: 0 },
    ]);
    expect(content.popularClasses).toEqual([]);
    expect(content.events).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(fallbackWarning, { locale: 'ru' });
  });

  it('treats an unpublished block the same way without reading its media', async () => {
    mocks.contentBlockFindUnique.mockResolvedValue({ body: activeBody, isActive: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const content = await getHomePageContent('hy');

    expect(content.hero.stats).toEqual([]);
    expect(mocks.mediaFindMany).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(fallbackWarning, { locale: 'hy' });
  });

  it('caps fallback style tiles at the CMS limit, most populated first', async () => {
    mocks.contentBlockFindUnique.mockResolvedValue(null);
    mocks.getStyleSummaries.mockResolvedValue(
      Array.from({ length: homeContentConfig.maxStyleTiles + 3 }, (_, index) => ({
        style: `STYLE_${index}`,
        slug: `style-${index}`,
        image: null,
        classCount: index,
        instructorCount: 0,
      })),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const content = await getHomePageContent('en');

    expect(content.styleTiles.map((tile) => tile.classCount)).toEqual(
      Array.from(
        { length: homeContentConfig.maxStyleTiles },
        (_, index) => homeContentConfig.maxStyleTiles + 2 - index,
      ),
    );
  });
});

describe('active home block with missing media', () => {
  it('renders without photos instead of throwing', async () => {
    mocks.contentBlockFindUnique.mockResolvedValue({ body: activeBody, isActive: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const content = await getHomePageContent('en');

    expect(content.hero.stats).toEqual([{ id: 'instructors', value: 40, suffix: '+', decimals: 0 }]);
    expect(content.hero.image).toEqual(emptyMediaRef);
    expect(content.editorial.image).toEqual(emptyMediaRef);
    expect(content.competition.image).toEqual(emptyMediaRef);
    expect(content.styleTiles.map((tile) => tile.image)).toEqual([emptyMediaRef]);
    expect(warn).toHaveBeenCalledWith('[home] media not found, rendering without image', {
      storageKey: 'home/hero.jpg',
    });
    expect(warn).toHaveBeenCalledTimes(4);
  });
});
