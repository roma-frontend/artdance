/**
 * GET /.well-known/assetlinks.json — ассоциация домена с Android-приложением (App Links).
 *
 * Отпечатки сертификатов задаются в `ANDROID_APP_SHA256_FINGERPRINTS` (через запятую).
 * Без них файл не отдаётся (404).
 */

import { NextResponse } from 'next/server';

import { appLinks } from '@/config/app-links';
import { getServerEnv } from '@/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const fingerprints = (getServerEnv().ANDROID_APP_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (fingerprints.length === 0) return new NextResponse('Not found', { status: 404 });

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: appLinks.bundleId,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
