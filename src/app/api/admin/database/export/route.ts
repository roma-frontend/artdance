import { NextResponse } from 'next/server';

import { requireOperator } from '@/lib/auth/guards';
import { exportModel } from '@/server/admin/operator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireOperator();
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const url = new URL(request.url);
  const model = url.searchParams.get('model') ?? '';
  if (!model) return NextResponse.json({ error: 'Missing model' }, { status: 400 });
  try {
    const rows = await exportModel(model);
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${model.toLowerCase()}.json"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Export failed' }, { status: 400 });
  }
}
