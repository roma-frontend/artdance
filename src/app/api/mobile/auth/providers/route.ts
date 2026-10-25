import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { socialProviderFlags } from '@/lib/auth/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/mobile/auth/providers — какие социальные входы настроены; приложение не рисует мёртвых кнопок. */
export function GET() {
  return NextResponse.json(socialProviderFlags, { headers: { 'Cache-Control': cacheControl.none } });
}
