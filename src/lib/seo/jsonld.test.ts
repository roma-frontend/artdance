/**
 * Структурированные данные не должны врать.
 *
 * Проверяется то, что нельзя увидеть глазами в разметке и что дорого исправлять
 * потом:
 *
 * • средний рейтинг не попадает в схему, пока отзывов мало — звёзды в выдаче,
 *   полученные на одном отзыве, живут месяцами;
 * • время события считается в поясе бизнеса, а не сервера: на Vercel он UTC, и
 *   «19:00» превратилось бы в 19:00Z, то есть 23:00 по Ереваду;
 * • цена всегда с кодом валюты из конфигурации;
 * • шаблон поиска содержит подстановку, а не URL-кодированные фигурные скобки.
 *
 * Числа берутся из демо-данных, а не выдумываются: тогда результат сравним с тем,
 * что видно на странице.
 */

import { describe, expect, it } from 'vitest';

import { demoEvents, demoVenues } from '../../../prisma/fixtures/demo';
import { currency, reviews as reviewRules } from '@/config';
import type { EventDetail, MediaRef, VenueDetail } from '@/domain/content';

import {
  aggregateRatingSchema,
  breadcrumbSchema,
  eventSchema,
  localBusinessSchema,
  websiteSchema,
} from './jsonld';

const image: MediaRef = { key: 'editorial-rhythm', alt: { hy: '', ru: '', en: '' } };

const demoEvent = demoEvents[0]!;
const demoVenue = demoVenues[0]!;

/** Событие 15 сентября 2026, 19:00–21:00 по Ереваду — как в демо-данных. */
const event: EventDetail = {
  slug: demoEvent.slug,
  title: demoEvent.title,
  description: demoEvent.description,
  type: demoEvent.type,
  startsAt: new Date('2026-09-15T00:00:00.000Z'),
  startTime: demoEvent.startTime,
  endTime: demoEvent.endTime,
  locationName: demoVenue.name,
  price: demoEvent.price,
  spotsLeft: demoEvent.spotsLeft,
  capacity: demoEvent.capacity,
  image,
  venueSlug: demoVenue.slug,
  venueDistrict: demoVenue.district,
  latitude: demoVenue.latitude,
  longitude: demoVenue.longitude,
};

const venue: VenueDetail = {
  slug: demoVenue.slug,
  name: demoVenue.name,
  description: demoVenue.description,
  district: demoVenue.district,
  amenities: [...demoVenue.amenities],
  pricePerHour: demoVenue.pricePerHour,
  ratingAverage: demoVenue.ratingAverage,
  ratingCount: demoVenue.ratingCount,
  image,
  areaSqm: demoVenue.areaSqm,
  capacity: demoVenue.capacity,
  latitude: demoVenue.latitude,
  longitude: demoVenue.longitude,
  classes: [],
  events: [],
  rating: { average: demoVenue.ratingAverage, count: demoVenue.ratingCount },
  reviews: [],
};

describe('aggregateRatingSchema', () => {
  it('молчит, пока отзывов меньше порога', () => {
    const belowThreshold = reviewRules.minCountToDisplayAverage - 1;
    expect(aggregateRatingSchema({ average: 5, count: belowThreshold })).toBeNull();
  });

  it('появляется ровно на пороге', () => {
    const schema = aggregateRatingSchema({
      average: 4.8,
      count: reviewRules.minCountToDisplayAverage,
    });

    expect(schema).not.toBeNull();
    expect(schema).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      reviewCount: reviewRules.minCountToDisplayAverage,
      bestRating: reviewRules.maxRating,
      worstRating: reviewRules.minRating,
    });
  });
});

describe('eventSchema', () => {
  const schema = eventSchema('en', event);

  it('считает начало и конец в поясе бизнеса, а не сервера', () => {
    /* Ереван — UTC+4 круглый год: 19:00 местного времени это 15:00Z. */
    expect(schema.startDate).toBe('2026-09-15T15:00:00.000Z');
    expect(schema.endDate).toBe('2026-09-15T17:00:00.000Z');
  });

  it('указывает цену с кодом валюты и наличие мест', () => {
    expect(schema.offers).toMatchObject({
      '@type': 'Offer',
      price: demoEvent.price,
      priceCurrency: currency.code,
      availability: 'https://schema.org/InStock',
    });
  });

  it('распродано означает SoldOut, а не отсутствие предложения', () => {
    const soldOut = eventSchema('en', { ...event, spotsLeft: 0 });
    expect(soldOut.offers).toMatchObject({ availability: 'https://schema.org/SoldOut' });
  });

  it('передаёт координаты площадки, когда они известны', () => {
    expect(schema.location).toMatchObject({
      geo: { latitude: demoVenue.latitude, longitude: demoVenue.longitude },
    });
  });

  it('без площадки каталога обходится без координат', () => {
    const external = eventSchema('en', {
      ...event,
      venueSlug: undefined,
      venueDistrict: undefined,
      latitude: undefined,
      longitude: undefined,
    });

    expect(external.location).not.toHaveProperty('geo');
  });
});

describe('localBusinessSchema', () => {
  const schema = localBusinessSchema('en', venue, ['Mirrors']);

  it('отдаёт координаты и вместимость зала', () => {
    expect(schema.geo).toMatchObject({
      latitude: demoVenue.latitude,
      longitude: demoVenue.longitude,
    });
    expect(schema.maximumAttendeeCapacity).toBe(demoVenue.capacity);
  });

  it('ставку указывает с кодом валюты', () => {
    expect(String(schema.priceRange)).toContain(currency.code);
  });

  it('оснащение перечисляет подписями, а не значениями enum', () => {
    expect(schema.amenityFeature).toEqual([
      { '@type': 'LocationFeatureSpecification', name: 'Mirrors', value: true },
    ]);
  });
});

describe('breadcrumbSchema', () => {
  const schema = breadcrumbSchema('en', [
    { name: 'Studios', path: '/studios' },
    { name: venue.name, path: `/studios/${venue.slug}` },
  ]);

  it('нумерует с единицы и даёт абсолютные адреса', () => {
    const items = schema.itemListElement as Array<Record<string, unknown>>;

    expect(items.map((item) => item.position)).toEqual([1, 2]);
    for (const item of items) {
      expect(String(item.item)).toMatch(/^https?:\/\/.+\/en\/studios/);
    }
  });
});

describe('websiteSchema', () => {
  it('объявляет поиск подстановкой, а не закодированными скобками', () => {
    const action = websiteSchema('en', 'ArtDance').potentialAction as Record<string, unknown>;
    const target = action.target as Record<string, unknown>;

    expect(String(target.urlTemplate)).toContain('{search_term_string}');
    expect(String(target.urlTemplate)).not.toContain('%7B');
  });
});
