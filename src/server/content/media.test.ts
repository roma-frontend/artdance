import { beforeEach, expect, it, vi } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ db: { mediaAsset: { findFirst } } }));
vi.mock('@/server/query', () => ({ defineQuery: (definition: { handler: unknown }) => definition.handler }));

import { seedMediaPath } from '@/design/seed-media';
import { mediaRef } from './media';

beforeEach(() => vi.resetAllMocks());

it('берёт переводы и параметры кадра из MediaAsset и снимает фрагмент владельца', async () => {
  findFirst.mockResolvedValue({
    storageKey: '/media/banner.webp#content:about', altText: 'Base description',
    translations: [{ locale: 'ru', altText: 'Описание из БД' }],
    width: 1200, height: 800, blurDataUrl: 'data:image/webp;base64,test',
    focalPoint: '25% 40%', sortOrder: 0,
  });
  expect(await mediaRef('/media/banner.webp')).toEqual({
    key: '/media/banner.webp', alt: { en: 'Base description', hy: 'Base description', ru: 'Описание из БД' },
    width: 1200, height: 800, blurDataUrl: 'data:image/webp;base64,test', focalPoint: '25% 40%',
  });
});

it('разрешает старое имя в точный путь манифеста, не в похожие имена файлов', async () => {
  findFirst.mockResolvedValue(null);
  await mediaRef('hero-dancer');
  const storageKey = seedMediaPath('hero-dancer');
  expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { OR: [{ storageKey }, { storageKey: { startsWith: `${storageKey}#` } }] },
  }));
});

it('отсутствующее или удалённое медиа не подменяет фикстурным изображением', async () => {
  findFirst.mockResolvedValue(null);
  expect(await mediaRef('hero-dancer')).toBeNull();
});
