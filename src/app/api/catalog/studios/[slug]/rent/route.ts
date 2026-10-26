/** Public room options for the native studio-rental screen. */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { venue } from '@/config/business';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { getRentableRooms } from '@/server/queries/venues';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await assertEntitlementOrThrow('events');
    const { slug } = await params;
    const rentable = await getRentableRooms(slug);
    if (!rentable || rentable.rooms.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', messageKey: 'errors.notFound.description' },
        { status: 404, headers: { 'Cache-Control': cacheControl.none } },
      );
    }
    return NextResponse.json(
      {
        venue: rentable,
        rules: {
          minMinutes: venue.minRentalMinutes,
          maxMinutes: venue.maxRentalMinutes,
          granularityMinutes: venue.rentalGranularityMinutes,
        },
      },
      { headers: { 'Cache-Control': cacheControl.none } },
    );
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json(
        { error: error.code, messageKey: error.messageKey, params: error.params },
        { status: httpStatusFor(error.code), headers: { 'Cache-Control': cacheControl.none } },
      );
    }
    console.error('[catalog/studios/rent]', error);
    return NextResponse.json(
      { error: 'INTERNAL', messageKey: 'errors.generic.description' },
      { status: 500, headers: { 'Cache-Control': cacheControl.none } },
    );
  }
}
