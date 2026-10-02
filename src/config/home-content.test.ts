import { describe, expect, it } from 'vitest';

import {
  homeContentBlockSchema,
  parseHomeContentBlock,
  type HomeContentBlock,
} from './home-content';

const valid: HomeContentBlock = {
  stats: [{ id: 'activeDancers', value: 2_500, suffix: '+', decimals: 0 }],
  media: {
    heroPosterStorageKey: 'hero',
    editorialPosterStorageKey: 'editorial',
    competitionPosterStorageKey: 'competition',
  },
  styleTiles: [{ style: 'SALSA', mediaStorageKey: 'style-salsa' }],
  collections: {
    popularClassSlugs: ['latin-fusion'],
    instructorSlugs: ['anna-mkrtchyan'],
    venueSlugs: ['pulse-dance-studio'],
    productSlugs: ['dance-shoes-collection'],
    eventSlugs: ['bachata-night-workshop'],
    testimonialAuthorEmails: ['reviewer@demo.artdance.am'],
  },
};

describe('CMS-конфигурация главной', () => {
  it('разбирает валидный JSON без преобразования значений', () => {
    expect(parseHomeContentBlock(JSON.stringify(valid))).toEqual(valid);
  });

  it('отклоняет не-JSON до запросов по ссылкам', () => {
    expect(() => parseHomeContentBlock('{')).toThrow();
  });

  it('отклоняет неизвестный stat id и стиль', () => {
    expect(
      homeContentBlockSchema.safeParse({
        ...valid,
        stats: [{ ...valid.stats[0]!, id: 'invented' }],
      }).success,
    ).toBe(false);
    expect(
      homeContentBlockSchema.safeParse({
        ...valid,
        styleTiles: [{ style: 'INVENTED', mediaStorageKey: 'image' }],
      }).success,
    ).toBe(false);
  });

  it('отклоняет дубли в показателях, стилях и подборках', () => {
    expect(
      homeContentBlockSchema.safeParse({
        ...valid,
        stats: [valid.stats[0], valid.stats[0]],
      }).success,
    ).toBe(false);
    expect(
      homeContentBlockSchema.safeParse({
        ...valid,
        styleTiles: [valid.styleTiles[0], valid.styleTiles[0]],
      }).success,
    ).toBe(false);
    expect(
      homeContentBlockSchema.safeParse({
        ...valid,
        collections: {
          ...valid.collections,
          popularClassSlugs: ['latin-fusion', 'latin-fusion'],
        },
      }).success,
    ).toBe(false);
  });
});
