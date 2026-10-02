/**
 * Ранжирование поиска без базы.
 *
 * Здесь проверяются обещания поиска: три алфавита, опечатка, смысловое
 * совпадение по направлению, качество порядка и стабильный предел. Prisma-слой
 * отдельно отвечает только за публичный отбор и сбор этих кандидатов.
 */

import { describe, expect, it } from 'vitest';

import { limits } from '@/config/business';
import {
  rankSearchCandidates,
  type SearchCandidate,
} from '@/domain/search-ranking';
import type { SearchScope } from '@/domain/search';

const LIMIT = limits.search.maxResults;

const candidates: readonly SearchCandidate[] = [
  {
    id: 'class-latin-fusion',
    scope: 'classes',
    title: 'Latin Fusion Night',
    subtitle: 'Anna Mkrtchyan',
    href: '/classes/latin-fusion-night',
    image: 'class-latin-fusion',
    price: 12_000,
    fields: ['Pulse Dance Studio', 'A social dance class'],
    styles: ['SALSA'],
  },
  {
    id: 'class-bachata',
    scope: 'classes',
    title: 'Bachata Basics',
    subtitle: 'Anna Mkrtchyan',
    href: '/classes/bachata-basics',
    image: 'class-bachata',
    price: 10_000,
    fields: ['Sensual partner work'],
    styles: ['BACHATA'],
  },
  {
    id: 'instructor-anna',
    scope: 'instructors',
    title: 'Anna Mkrtchyan',
    subtitle: 'Salsa and Bachata instructor',
    href: '/instructors/anna-mkrtchyan',
    image: 'instructor-anna',
    price: 15_000,
    fields: ['Latin dance teacher'],
    styles: ['SALSA', 'BACHATA'],
  },
  {
    id: 'venue-pulse',
    scope: 'studios',
    title: 'Pulse Dance Studio',
    subtitle: 'Kentron',
    href: '/studios/pulse-dance-studio',
    image: 'venue-pulse',
    price: 8_000,
    fields: ['Кентрон', 'Mirrors and sound system'],
    styles: ['SALSA'],
  },
  {
    id: 'product-shoes',
    scope: 'products',
    title: 'Dance Shoes',
    subtitle: 'ArtDance',
    href: '/shop/dance-shoes',
    image: 'product-shoes',
    price: 25_000,
    fields: ['Professional shoes'],
  },
];

function hits(term: string, scope: SearchScope = 'all', limit: number = LIMIT) {
  const scoped =
    scope === 'all' ? candidates : candidates.filter((item) => item.scope === scope);
  return rankSearchCandidates(scoped, term, limit);
}

function titles(term: string, scope: SearchScope = 'all'): string[] {
  return hits(term, scope).map((hit) => hit.title);
}

describe('поиск: что именно находится', () => {
  it('находит сущность по слову из названия', () => {
    expect(titles('latin')).toContain('Latin Fusion Night');
  });

  it('находит инструктора по имени на трёх алфавитах', () => {
    expect(titles('anna', 'instructors')).toContain('Anna Mkrtchyan');
    expect(titles('Анна', 'instructors')).toContain('Anna Mkrtchyan');
    expect(titles('Աննա', 'instructors')).toContain('Anna Mkrtchyan');
  });

  it('прощает опечатку в запросе', () => {
    expect(titles('bahata')).toEqual(titles('bachata'));
  });

  it('находит занятие и зал по направлению, которого нет в названии занятия', () => {
    expect(titles('сальса', 'classes')).toContain('Latin Fusion Night');
    expect(titles('salsa', 'studios')).toContain('Pulse Dance Studio');
  });

  it('не падает на пустых связанных полях после сериализации кеша', () => {
    const candidate: SearchCandidate = {
      ...candidates[0]!,
      id: 'class-with-empty-relations',
      title: 'Independent Class',
      fields: [null, undefined, 'Kentron'],
    };

    expect(rankSearchCandidates([candidate], 'kentron', LIMIT)).toHaveLength(1);
  });

  it('не находит отсутствующий контент', () => {
    expect(hits('квантовая механика')).toHaveLength(0);
  });
});

describe('поиск: порядок и границы', () => {
  it('совпадение в названии выше совпадения в связанном поле', () => {
    const found = hits('pulse');
    expect(found[0]?.scope).toBe('studios');
    expect(found.some((hit) => hit.scope === 'classes')).toBe(true);
  });

  it('находит зал по району на кириллице', () => {
    expect(titles('Кентрон', 'studios')).toContain('Pulse Dance Studio');
  });

  it('стабилен между одинаковыми вызовами', () => {
    expect(hits('dance')).toEqual(hits('dance'));
  });

  it('соблюдает предел и границы раздела', () => {
    expect(hits('', 'all', 3)).toHaveLength(3);
    expect(hits('dance', 'instructors').every((hit) => hit.scope === 'instructors')).toBe(true);
    expect(hits('', 'all', -1)).toHaveLength(0);
  });

  it('не теряет поля публичного результата', () => {
    for (const hit of hits('')) {
      expect(hit.title).not.toBe('');
      expect(hit.href).toMatch(/^\/(classes|instructors|studios|events|shop)\//);
      expect(hit.image).not.toBe('');
    }
  });
});
