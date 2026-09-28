/**
 * FAVORITES SERVICE — 4.10 (избранное).
 *
 * Серверный toggle поверх таблицы Favorite. Разрешает только публичные сущности.
 */

import 'server-only';

import { domainErrors } from '@/domain/errors';
import { db } from '@/lib/db';

import { publicClassWhere } from '../queries/classes';
import { publicInstructorWhere } from '../queries/instructors';
import { publicProductWhere } from '../queries/products';
import { publicVenueWhere } from '../queries/venues';

export type FavoriteTarget = 'class' | 'instructor' | 'venue' | 'product';

export async function toggleFavorite(input: { userId: string; target: FavoriteTarget; slug: string }): Promise<{ isFavorite: boolean }> {
  const { userId, target, slug } = input;
  let exists: boolean;
  let idKey: string;
  let idValue: string;

  if (target === 'class') {
    const row = await db.danceClass.findFirst({ where: { slug, ...publicClassWhere }, select: { id: true } });
    if (!row) throw domainErrors.notFound();
    idKey = 'classId';
    idValue = row.id;
    exists = !!(await db.favorite.findUnique({ where: { userId_classId: { userId, classId: row.id } } as unknown as never }));
  } else if (target === 'instructor') {
    const row = await db.instructorProfile.findFirst({ where: { slug, ...publicInstructorWhere }, select: { id: true } });
    if (!row) throw domainErrors.notFound();
    idKey = 'instructorId';
    idValue = row.id;
    exists = !!(await db.favorite.findUnique({ where: { userId_instructorId: { userId, instructorId: row.id } } as unknown as never }));
  } else if (target === 'venue') {
    const row = await db.venue.findFirst({ where: { slug, ...publicVenueWhere }, select: { id: true } });
    if (!row) throw domainErrors.notFound();
    idKey = 'venueId';
    idValue = row.id;
    exists = !!(await db.favorite.findUnique({ where: { userId_venueId: { userId, venueId: row.id } } as unknown as never }));
  } else {
    const row = await db.product.findFirst({ where: { slug, ...publicProductWhere }, select: { id: true } });
    if (!row) throw domainErrors.notFound();
    idKey = 'productId';
    idValue = row.id;
    exists = !!(await db.favorite.findUnique({ where: { userId_productId: { userId, productId: row.id } } as unknown as never }));
  }

  if (exists) {
    await db.favorite.delete({ where: { [idKey === 'classId' ? 'userId_classId' : idKey === 'instructorId' ? 'userId_instructorId' : idKey === 'venueId' ? 'userId_venueId' : 'userId_productId']: { userId, [idKey]: idValue } } as unknown as never });
    return { isFavorite: false };
  }
  await db.favorite.create({ data: { userId, [idKey]: idValue } as unknown as never });
  return { isFavorite: true };
}
