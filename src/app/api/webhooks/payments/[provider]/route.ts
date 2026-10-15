import { NextResponse } from 'next/server';

import { getServerEnv } from '@/config/env';
import { processWebhookPayment } from '@/server/payments/webhooks';
import type { PaymentProviderId } from '@/lib/payments/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowed: ReadonlySet<PaymentProviderId> = new Set(['mock', 'stripe', 'paynet', 'arca-epg', 'ameria-vpos', 'idram']);

function noStore(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!allowed.has(provider as PaymentProviderId)) return noStore({ error: 'UNKNOWN_PROVIDER' }, 404);

  const providerId = provider as PaymentProviderId;
  {
    const env = getServerEnv() as Record<string, unknown>;
    const needSecret =
      providerId === 'stripe' ? !env.STRIPE_WEBHOOK_SECRET :
      providerId === 'paynet' ? !env.PAYNET_WEBHOOK_SECRET :
      providerId === 'arca-epg' ? !env.ARCA_EPG_WEBHOOK_SECRET && !env.ARCA_WEBHOOK_SECRET :
      providerId === 'ameria-vpos' ? !env.AMERIA_VPOS_WEBHOOK_SECRET :
      providerId === 'idram' ? !env.IDRAM_WEBHOOK_SECRET : false;
    if (needSecret) return noStore({ error: 'WEBHOOK_NOT_CONFIGURED' }, 503);
  }

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  for (const [k, v] of request.headers.entries()) headers[k] = v;

  const result = await processWebhookPayment({ provider: providerId, rawBody, headers });
  // 5.2 — никогда не 500. 400 только за подпись, остальное 200 с логом.
  return new NextResponse(result.body, { status: result.httpStatus, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  return noStore({ error: 'METHOD_NOT_ALLOWED' }, 405);
}
