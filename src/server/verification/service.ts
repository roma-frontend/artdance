import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { canGoVerified } from '@/domain/verification';

export async function submitVerificationDocument(input: { instructorId: string; type: string; storageKey: string }) {
  if (!input.type.trim() || !input.storageKey.trim()) throw domainErrors.validationFailed('type');
  return db.verificationDocument.create({ data: { instructorId: input.instructorId, type: input.type.trim(), storageKey: input.storageKey.trim() } });
}

export async function approveVerificationDocument(documentId: string) {
  const doc = await db.verificationDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw domainErrors.notFound();
  const updated = await db.verificationDocument.update({ where: { id: documentId }, data: { status: 'APPROVED' } });
  const allDocs = await db.verificationDocument.findMany({ where: { instructorId: (doc as unknown as { instructorId: string }).instructorId } });
  if (canGoVerified(allDocs as unknown as { status: string }[])) {
    await db.instructorProfile.update({ where: { id: (doc as unknown as { instructorId: string }).instructorId }, data: { isVerified: true } });
  }
  return updated;
}

export async function rejectVerificationDocument(documentId: string, note?: string | null) {
  return db.verificationDocument.update({ where: { id: documentId }, data: { status: 'REJECTED', note: note ?? null } });
}
