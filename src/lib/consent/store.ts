/**
 * CONSENT STORE — фиксация согласий на обработку ПДн.
 *
 * Каждое согласие пишется в ConsentRecord снимком: email + documentId + version +
 * IP + время. Перезапись не стирает прошлое, повтор равен успеху (идемпотентно).
 */

import 'server-only';

import { db } from '@/lib/db';

export async function recordConsent(params: {
  email: string;
  documentId: string;
  version: string;
  userId?: string | null;
  ipAddress?: string | null;
}): Promise<void> {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedEmail || !params.documentId || !params.version) return;
  try {
    await db.consentRecord.create({
      data: {
        email: normalizedEmail,
        documentId: params.documentId,
        version: params.version,
        userId: params.userId ?? null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (error: unknown) {
    // Уникальный индекс [email, documentId, version] — дубль не ошибка.
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') return;
    console.error('[consent] запись не удалась', error);
  }
}

export async function hasConsent(email: string, documentId: string, version: string): Promise<boolean> {
  const found = await db.consentRecord.findFirst({
    where: { email: email.trim().toLowerCase(), documentId, version },
    select: { id: true },
  });
  return found !== null;
}
