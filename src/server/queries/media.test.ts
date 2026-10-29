import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/config';

import {
  firstMediaRef,
  galleryRefs,
  heroMediaRef,
  liveSingleMedia,
  trashableMediaSelect,
  toMediaRef,
  type MediaRow,
  type TrashableMediaRow,
} from './media';

const base: MediaRow = {
  storageKey: 'classes/c-1/style-salsa.webp',
  altText: 'Base description',
  width: 1200,
  height: 800,
  blurDataUrl: 'data:image/webp;base64,AAAA',
  focalPoint: '50% 40%',
  purpose: null,
  sortOrder: 0,
  translations: [],
};

const row = (overrides: Partial<MediaRow>): MediaRow => ({ ...base, ...overrides });

describe('toMediaRef', () => {
  it('снимает фрагмент владельца из ключа файла', () => {
    const ref = toMediaRef(row({ storageKey: 'classes/c-1/style-salsa.webp#class:latin-fusion' }));
    expect(ref.key).toBe('classes/c-1/style-salsa.webp');
  });

  it('без переводов alt для всех локалей берётся из базового описания', () => {
    const ref = toMediaRef(row({ altText: 'Base description', translations: [] }));
    for (const locale of locales) {
      expect(ref.alt[locale], locale).toBe('Base description');
    }
  });

  it('перевод заменяет описание только своей локали', () => {
    const ref = toMediaRef(row({ altText: 'Base', translations: [{ locale: 'ru', altText: 'Ru' }] }));
    expect(ref.alt).toEqual({ hy: 'Base', ru: 'Ru', en: 'Base' });
  });

  it('размеры, фокус и плейсхолдер переносятся в ссылку', () => {
    const ref = toMediaRef(base);
    expect(ref).toMatchObject({
      width: 1200,
      height: 800,
      focalPoint: '50% 40%',
      blurDataUrl: 'data:image/webp;base64,AAAA',
    });
  });

  it('отсутствующие размеры не появляются в ссылке как ключи', () => {
    const ref = toMediaRef(row({ width: null, height: null, blurDataUrl: null, focalPoint: null }));
    expect(ref).not.toHaveProperty('width');
    expect(ref).not.toHaveProperty('height');
    expect(ref).not.toHaveProperty('blurDataUrl');
    expect(ref).not.toHaveProperty('focalPoint');
  });
});

describe('firstMediaRef', () => {
  it('пустой список даёт null, а не заглушку', () => {
    expect(firstMediaRef([])).toBeNull();
  });

  it('берёт кадр с наименьшим sortOrder, а не первый в списке', () => {
    const ref = firstMediaRef([
      row({ storageKey: 'b.webp', sortOrder: 2 }),
      row({ storageKey: 'a.webp', sortOrder: 1 }),
    ]);
    expect(ref?.key).toBe('a.webp');
  });

  it('фоновый кадр пропускается, если есть обычный', () => {
    const ref = firstMediaRef([
      row({ storageKey: 'bg.webp', purpose: 'background', sortOrder: 0 }),
      row({ storageKey: 'card.webp', purpose: null, sortOrder: 1 }),
    ]);
    expect(ref?.key).toBe('card.webp');
  });

  it('если все кадры фоновые, берётся первый по порядку', () => {
    const ref = firstMediaRef([
      row({ storageKey: 'bg-2.webp', purpose: 'background', sortOrder: 5 }),
      row({ storageKey: 'bg-1.webp', purpose: 'background', sortOrder: 1 }),
    ]);
    expect(ref?.key).toBe('bg-1.webp');
  });
});

describe('heroMediaRef', () => {
  it('предпочитает фоновый кадр, даже если он не первый по порядку', () => {
    const ref = heroMediaRef([
      row({ storageKey: 'card.webp', purpose: null, sortOrder: 0 }),
      row({ storageKey: 'hero.webp', purpose: 'background', sortOrder: 3 }),
    ]);
    expect(ref?.key).toBe('hero.webp');
  });

  it('без фонового кадра берёт первый по порядку', () => {
    const ref = heroMediaRef([
      row({ storageKey: 'second.webp', sortOrder: 2 }),
      row({ storageKey: 'first.webp', sortOrder: 1 }),
    ]);
    expect(ref?.key).toBe('first.webp');
  });

  it('пустой список даёт null', () => {
    expect(heroMediaRef([])).toBeNull();
  });
});

describe('galleryRefs', () => {
  it('возвращает все кадры в порядке sortOrder', () => {
    const refs = galleryRefs([
      row({ storageKey: 'c.webp', sortOrder: 3 }),
      row({ storageKey: 'a.webp', sortOrder: 1 }),
      row({ storageKey: 'b.webp', sortOrder: 2 }),
    ]);
    expect(refs.map((ref) => ref.key)).toEqual(['a.webp', 'b.webp', 'c.webp']);
  });

  it('не переставляет входной массив', () => {
    const rows = [row({ storageKey: 'b.webp', sortOrder: 2 }), row({ storageKey: 'a.webp', sortOrder: 1 })];
    galleryRefs(rows);
    expect(rows.map((item) => item.storageKey)).toEqual(['b.webp', 'a.webp']);
  });
});

describe('liveSingleMedia', () => {
  const live: TrashableMediaRow = { ...base, deletedAt: null };

  it('живой кадр отдаётся тем же объектом', () => {
    expect(liveSingleMedia(live)).toBe(live);
  });

  it('удалённый кадр не показывается', () => {
    expect(liveSingleMedia({ ...base, deletedAt: new Date('2026-01-01T00:00:00Z') })).toBeNull();
  });

  it('отсутствующая связь даёт null', () => {
    expect(liveSingleMedia(null)).toBeNull();
    expect(liveSingleMedia(undefined)).toBeNull();
  });
});

describe('trashableMediaSelect', () => {
  it('читает deletedAt вместе с кадром, иначе проверка в liveSingleMedia невозможна', () => {
    expect(trashableMediaSelect.deletedAt).toBe(true);
    expect(trashableMediaSelect.storageKey).toBe(true);
  });
});
