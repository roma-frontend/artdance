import 'server-only';

/**
 * ИЗБРАННОЕ — то, что человек сохранил у себя.
 *
 * **Без кеша, и это не оптимизация «на потом».** `defineQuery` кеширует ответ по
 * тегам, а здесь ответ персональный: один кеш на тег `favorites` отдал бы список
 * одного человека другому. Поэтому обычная функция и прямой запрос.
 *
 * **Скрытое из каталога не показывается и здесь.** Сохранённое занятие могло быть
 * снято с публикации, инструктор — уйти на модерацию, товар — стать неактивным.
 * Условия те же самые константы (`publicClassWhere` и остальные), что и в
 * каталоге: иначе «Избранное» превратилось бы в чёрный ход к скрытым записям.
 *
 * Четыре вида в одной таблице `Favorite` (занятие, инструктор, площадка, товар) —
 * четыре запроса, а не один. Объединить их нельзя: у каждого свой `select` со
 * своими соединениями, и это ровно то соображение, что и в реестре админки.
 */

import { limits } from '@/config/business';
import type {
  ClassCardItem,
  InstructorCardItem,
  ProductCardItem,
  VenueCardItem,
} from '@/domain/content';
import { db } from '@/lib/db';

import { classSelect, publicClassWhere, toClassCard, type ClassRow } from './classes';
import {
  instructorSelect,
  publicInstructorWhere,
  toInstructorCard,
  type InstructorRow,
} from './instructors';
import { productSelect, publicProductWhere, toProductCard, type ProductRow } from './products';
import { publicVenueWhere, toVenueCard, venueSelect, type VenueRow } from './venues';

export interface FavoriteCollections {
  classes: readonly ClassCardItem[];
  instructors: readonly InstructorCardItem[];
  venues: readonly VenueCardItem[];
  products: readonly ProductCardItem[];
  /** Всего сохранённого после отсева скрытого — по нему решается пустое состояние. */
  total: number;
}

export async function getFavorites(userId: string): Promise<FavoriteCollections> {
  const take = limits.query.maxRows;

  /*
   * Идентификаторы берутся одним запросом, а сами записи — по видам. Порядок
   * сохранения важен: последнее сохранённое человек ищет первым.
   */
  const rows = await db.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { classId: true, instructorId: true, venueId: true, productId: true },
  });

  const ids = (key: 'classId' | 'instructorId' | 'venueId' | 'productId'): string[] =>
    rows.map((row) => row[key]).filter((value): value is string => value !== null);

  const classIds = ids('classId');
  const instructorIds = ids('instructorId');
  const venueIds = ids('venueId');
  const productIds = ids('productId');

  const [classRows, instructorRows, venueRows, productRows] = await Promise.all([
    classIds.length === 0
      ? []
      : (db.danceClass.findMany({
          where: { id: { in: classIds }, ...publicClassWhere },
          select: classSelect,
        }) as unknown as Promise<ClassRow[]>),
    instructorIds.length === 0
      ? []
      : (db.instructorProfile.findMany({
          where: { id: { in: instructorIds }, ...publicInstructorWhere },
          select: instructorSelect,
        }) as unknown as Promise<InstructorRow[]>),
    venueIds.length === 0
      ? []
      : (db.venue.findMany({
          where: { id: { in: venueIds }, ...publicVenueWhere },
          select: venueSelect,
        }) as unknown as Promise<VenueRow[]>),
    productIds.length === 0
      ? []
      : (db.product.findMany({
          where: { id: { in: productIds }, ...publicProductWhere },
          select: productSelect,
        }) as unknown as Promise<ProductRow[]>),
  ]);

  const classes = classRows.map(toClassCard);
  const instructors = instructorRows.map(toInstructorCard);
  const venues = venueRows.map(toVenueCard);
  const products = productRows.map(toProductCard);

  return {
    classes,
    instructors,
    venues,
    products,
    total: classes.length + instructors.length + venues.length + products.length,
  };
}
