import { NextResponse } from 'next/server';

import { getGodPulse } from '@/server/admin/god';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pulse = await getGodPulse();
    return NextResponse.json(pulse, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
}
