/**
 * GET /.well-known/apple-app-site-association — ассоциация домена с iOS-приложением.
 *
 * Team ID в коде не угадывается: значение `APPLE_APP_ID` задаётся в окружении.
 * Без него файл не отдаётся (404). Apple требует ответ 200 без редиректов.
 */

import { NextResponse } from 'next/server';

import { appLinks } from '@/config/app-links';
import { getServerEnv } from '@/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const appId = getServerEnv().APPLE_APP_ID;
  if (!appId) return new NextResponse('Not found', { status: 404 });

  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [appId],
            components: appLinks.prefixes.map((prefix) => ({ '/': `${prefix}*` })),
          },
        ],
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
