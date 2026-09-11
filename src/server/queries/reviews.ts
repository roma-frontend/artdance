/**
 * ОТЗЫВЫ: ОДИН НАБОР ПОЛЕЙ И ОДНО ОТОБРАЖЕНИЕ.
 *
 * Отзывы читают четыре страницы (занятие, инструктор, площадка, товар), и
 * различий между ними нет — кроме того, к какой сущности отзыв привязан. Копия
 * `select` в каждом запросе означала бы, что однажды на одной из страниц
 * перестанет приходить признак подтверждённой брони или подпись автора.
 *
 * **Показываются только одобренные.** Условие живёт в `approvedReviewsWhere`:
 * отзыв на модерации, попавший на страницу, — это публикация непроверенного
 * текста от лица платформы.
 */

import 'server-only';

import { reviews as reviewRules } from '@/config/business';
import type { RatingSummary, ReviewItem } from '@/domain/content';

import { firstMediaRef, type MediaRow } from './media';
import { mediaRelation } from './relations';

export const approvedReviewsWhere = { moderation: 'APPROVED' as const };

export const reviewSelect = {
  id: true,
  rating: true,
  body: true,
  authorRole: true,
  isVerifiedPurchase: true,
  author: { select: { name: true } },
  /*
   * Кадр берётся у того, О КОМ отзыв, а не у автора.
   *
   * Портрета клиента в схеме нет: `MediaAsset` привязывается к сущностям
   * каталога, а не к пользователю (аватар — это `User.avatarKey`, задача
   * кабинета). В макете рядом с отзывом стоит фотография; когда её нет, компонент
   * `Media` рисует заглушку роли, а не пустое место.
   */
  instructor: { select: { media: mediaRelation } },
  danceClass: { select: { media: mediaRelation } },
  venue: { select: { media: mediaRelation } },
  product: { select: { media: mediaRelation } },
} as const;

export interface ReviewRow {
  id: string;
  rating: number;
  body: string;
  authorRole: string | null;
  isVerifiedPurchase: boolean;
  author: { name: string };
  instructor: { media: MediaRow[] } | null;
  danceClass: { media: MediaRow[] } | null;
  venue: { media: MediaRow[] } | null;
  product: { media: MediaRow[] } | null;
}

export function toReview(row: ReviewRow): ReviewItem {
  const targetMedia =
    firstMediaRef(row.instructor?.media ?? []) ??
    firstMediaRef(row.danceClass?.media ?? []) ??
    firstMediaRef(row.venue?.media ?? []) ??
    firstMediaRef(row.product?.media ?? []);

  return {
    id: row.id,
    authorName: row.author.name,
    authorRole: row.authorRole ?? '',
    rating: row.rating,
    body: row.body,
    /*
     * Флаг из данных, а не только из правила: при `requireVerifiedPurchase`
     * отзывов без брони не появляется, но исторические строки остаются как есть,
     * и бейдж обязан говорить правду про конкретный отзыв.
     */
    isVerifiedPurchase: reviewRules.requireVerifiedPurchase || row.isVerifiedPurchase,
    image: targetMedia ?? { key: '', alt: { hy: '', ru: '', en: '' } },
  };
}

/**
 * Отзывы и агрегат рейтинга.
 *
 * `known` — денормализованные `ratingAverage`/`ratingCount` владельца. Когда они
 * есть, среднее берётся оттуда: «какая у него оценка» и «что именно писали» —
 * разные вопросы, и на первый отвечает счётчик, который знает про все отзывы, а
 * не про первую их страницу.
 */
export function ratingFrom(
  rows: readonly ReviewRow[],
  known?: { average: number; count: number },
): { rating: RatingSummary; items: readonly ReviewItem[] } {
  const items = rows.map(toReview);
  if (known) return { rating: known, items };

  const count = rows.length;
  const average = count === 0 ? 0 : rows.reduce((sum, row) => sum + row.rating, 0) / count;
  return { rating: { average, count }, items };
}
