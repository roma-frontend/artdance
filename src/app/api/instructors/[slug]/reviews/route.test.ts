/**
 * Контракт `/api/instructors/[slug]/reviews` для мобильного приложения.
 *
 * Проверяется то, на что полагается клиент: код 404 для неизвестного инструктора
 * и страницы за пределами списка, нормализация номера страницы и запрет кеширования.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getInstructorReviewsPage = vi.hoisted(() => vi.fn());
vi.mock('@/server/queries/instructors', () => ({ getInstructorReviewsPage }));

import { GET } from './route';
import { limits } from '@/config/business';
import { cacheControl } from '@/config/cache';

const pageSize = limits.pagination.reviewsPerPage;

function call(slug: string, query = ''): Promise<Response> {
  return GET(
    new Request(`https://artdance.test/api/instructors/${slug}/reviews${query}`),
    { params: Promise.resolve({ slug }) },
  );
}

function pageWith(total: number, page = 1) {
  return { rating: { average: 4.5, count: total }, items: [], total, page, pageSize };
}

beforeEach(() => {
  getInstructorReviewsPage.mockReset();
});

describe('GET /api/instructors/[slug]/reviews', () => {
  it('возвращает 404, если инструктор не найден или не публичен', async () => {
    getInstructorReviewsPage.mockResolvedValue(null);

    const response = await call('missing');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  });

  it('отдаёт страницу с числом страниц, посчитанным от общего количества', async () => {
    getInstructorReviewsPage.mockResolvedValue(pageWith(pageSize * 2 + 1));

    const response = await call('teacher');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.totalPages).toBe(3);
    expect(body.total).toBe(pageSize * 2 + 1);
  });

  it('при отсутствии отзывов число страниц равно единице, а не нулю', async () => {
    getInstructorReviewsPage.mockResolvedValue(pageWith(0));

    const body = await (await call('teacher')).json();
    expect(body.totalPages).toBe(1);
  });

  it('страница за пределами списка — 404', async () => {
    getInstructorReviewsPage.mockResolvedValue(pageWith(0));

    const response = await call('teacher', '?page=2');
    expect(response.status).toBe(404);
  });

  it.each(['abc', '0', '-3', '1.5', ''])('некорректный номер страницы %j читается как первая', async (raw) => {
    getInstructorReviewsPage.mockResolvedValue(pageWith(0));

    await call('teacher', `?page=${raw}`);
    expect(getInstructorReviewsPage).toHaveBeenLastCalledWith({ slug: 'teacher', page: 1, pageSize });
  });

  it('передаёт номер страницы из запроса и размер страницы из конфигурации', async () => {
    getInstructorReviewsPage.mockResolvedValue(pageWith(pageSize * 3, 2));

    await call('teacher', '?page=2');
    expect(getInstructorReviewsPage).toHaveBeenLastCalledWith({ slug: 'teacher', page: 2, pageSize });
  });

  it('запрещает кеширование: отзыв, одобренный модерацией, должен появиться сразу', async () => {
    getInstructorReviewsPage.mockResolvedValue(pageWith(0));

    const response = await call('teacher');
    expect(response.headers.get('Cache-Control')).toBe(cacheControl.none);
  });
});
