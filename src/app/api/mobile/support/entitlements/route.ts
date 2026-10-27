import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setEntitlementOverride, setEntitlementPreset } from '@/server/actions/admin/entitlements';
import { operatorGate } from '@/server/admin/mobile-support';
import { entitlementFeatureCatalog, entitlementPresets } from '@/server/entitlements/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' } as const;

const bodySchema = z.union([
  z.object({ preset: z.enum(entitlementPresets) }),
  z.object({
    key: z.enum(entitlementFeatureCatalog.map((f) => f.key) as [string, ...string[]]),
    enabled: z.boolean().nullable(),
  }),
]);

export async function POST(request: Request) {
  const gate = await operatorGate();
  if (!gate.ok) return NextResponse.json({ error: gate.status === 401 ? 'unauthorized' : 'forbidden' }, { status: gate.status, headers: noStore });
  if (!gate.canManageEntitlements) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: noStore });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400, headers: noStore });

  const result =
    'preset' in parsed.data
      ? await setEntitlementPreset({ preset: parsed.data.preset })
      : await setEntitlementOverride(parsed.data);

  if (result.serverError || result.validationErrors) {
    return NextResponse.json({ error: result.serverError ?? 'invalid_input' }, { status: 400, headers: noStore });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
