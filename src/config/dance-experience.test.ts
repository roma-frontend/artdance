import { describe, expect, it } from 'vitest';
import { danceIntents, danceMood, suggestedDanceStyles } from './dance-experience';
import { parseCatalogQuery } from '@/domain/catalog';
import { routes } from './routes';

describe('dance suggestions', () => {
  it('only suggests directions actually supplied by the catalog', () => {
    expect(suggestedDanceStyles('partner', ['SALSA', 'BACHATA', 'HIP_HOP', 'UNKNOWN'])).toEqual(['SALSA', 'BACHATA']);
    expect(suggestedDanceStyles('flow', ['HIP_HOP'])).toEqual([]);
  });
  it('does not duplicate a direction or mutate CMS order', () => {
    const input = ['BACHATA', 'SALSA', 'SALSA'];
    expect(suggestedDanceStyles('partner', input)).toEqual(['SALSA', 'BACHATA']);
    expect(input).toEqual(['BACHATA', 'SALSA', 'SALSA']);
  });
  it('every intent handles an empty catalog', () => {
    for (const intent of danceIntents) expect(suggestedDanceStyles(intent, [])).toEqual([]);
  });
  it('assigns distinct motion characters without inventing domain enum values', () => {
    expect(danceMood('HIP_HOP')).toBe('pulse');
    expect(danceMood('BALLET')).toBe('flow');
    expect(danceMood('TANGO')).toBe('embrace');
    expect(danceMood('BALLROOM')).toBe('stage');
    expect(danceMood('UNKNOWN')).toBe('stage');
  });
  it('catalog URL roundtrips supported style, level and date', () => {
    const url = new URL(routes.discover({ scope: 'classes', style: 'SALSA', level: 'BEGINNER', date: '2026-12-01' }), 'https://example.test');
    const parsed = parseCatalogQuery(Object.fromEntries(url.searchParams));
    expect(parsed.style).toBe('SALSA');
    expect(parsed.level).toBe('BEGINNER');
    expect(parsed.date).toBe('2026-12-01');
    expect(url.searchParams.get('scope')).toBe('classes');
  });
});
