import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { publicClassWhere } from '@/server/queries/classes';
import { publicInstructorWhere } from '@/server/queries/instructors';
import { publicProductWhere } from '@/server/queries/products';
import { publicVenueWhere } from '@/server/queries/venues';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Список ключей избранного для текущего пользователя.
 * Нужен `FavoriteButton`, чтобы залогиненный видел закрашенное сердце
 * сразу после перезагрузки, а не только после своего клика (localStorage пуст).
 */
export async function GET() {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ keys: [] as string[] }, { headers: { 'Cache-Control': cacheControl.none } });
  }

  const rows = await db.favorite.findMany({
    where: { userId: caller.id },
    select: { classId: true, instructorId: true, venueId: true, productId: true },
  });

  const classIds = rows.map((r) => r.classId).filter((v): v is string => !!v);
  const instructorIds = rows.map((r) => r.instructorId).filter((v): v is string => !!v);
  const venueIds = rows.map((r) => r.venueId).filter((v): v is string => !!v);
  const productIds = rows.map((r) => r.productId).filter((v): v is string => !!v);

  const [classes, instructors, venues, products] = await Promise.all([
    classIds.length ? db.danceClass.findMany({ where: { id: { in: classIds }, ...publicClassWhere }, select: { slug: true } }) : [],
    instructorIds.length
      ? db.instructorProfile.findMany({ where: { id: { in: instructorIds }, ...publicInstructorWhere }, select: { slug: true } })
      : [],
    venueIds.length ? db.venue.findMany({ where: { id: { in: venueIds }, ...publicVenueWhere }, select: { slug: true } }) : [],
    productIds.length ? db.product.findMany({ where: { id: { in: productIds }, ...publicProductWhere }, select: { slug: true } }) : [],
  ]);

  const keys: string[] = [
    ...classes.map((r) => `class:${r.slug}`),
    ...instructors.map((r) => `instructor:${r.slug}`),
    ...venues.map((r) => `venue:${r.slug}`),
    ...products.map((r) => `product:${r.slug}`),
  ];

  return NextResponse.json({ keys }, { headers: { 'Cache-Control': cacheControl.none } });
}
