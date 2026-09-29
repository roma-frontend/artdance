import 'server-only';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth/auth';
import { domainErrors } from '@/domain/errors';
import { classPassById } from '@/config/pricing';

import { purchaseClassPass } from '@/server/class-pass/service';


export async function purchaseClassPassAction(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = (session as { user?: { id?: string } } | null)?.user?.id ?? null;
  if (!userId) throw domainErrors.unauthorized();
  const passId = String(formData.get('passId') ?? '').trim();
  if (!passId) throw domainErrors.validationFailed('passId');
  const offer = classPassById(passId);
  if (!offer) throw domainErrors.notFound();
  await purchaseClassPass({
    userId,
    passId: offer.id,
    idempotencyKey: `class-pass:${userId}:${offer.id}:${Date.now()}`,
    now: new Date(),
  });
}

export async function buyClassPass(passId: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const fd = new FormData();
  fd.set('passId', passId);
  try {
    await purchaseClassPassAction(fd);
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'UNKNOWN';
    return { ok: false, error: code };
  }
}
