import 'server-only';

import { db } from '@/lib/db';
import { requireOperator } from '@/lib/auth/guards';
import { putMediaObject } from '@/lib/media/storage';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/avif',
  'application/pdf',
  'text/plain',
]);
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'pdf', 'txt']);
const MAX_BYTES = 8 * 1024 * 1024;

function extOf(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
}

export async function uploadTicketAttachment(input: {
  ticketId: string;
  replyId?: string | null;
  file: File;
}) {
  const caller = await requireOperator();
  const ticket = await db.supportTicket.findUnique({ where: { id: input.ticketId }, select: { id: true } });
  if (!ticket) throw new Error('Ticket not found');
  if (input.replyId) {
    const reply = await db.supportReply.findUnique({ where: { id: input.replyId }, select: { id: true, ticketId: true } });
    if (!reply || reply.ticketId !== input.ticketId) throw new Error('Reply not found');
  }

  const mime = (input.file.type || '').toLowerCase();
  const ext = extOf(input.file.name);
  if (!ALLOWED_MIME.has(mime) && !ALLOWED_EXT.has(ext)) throw new Error('Unsupported file type');
  if (!ALLOWED_EXT.has(ext)) throw new Error('Unsupported extension');
  if (input.file.size > MAX_BYTES) throw new Error('File too large (max 8 MB)');
  const existing = await db.supportAttachment.count({ where: { ticketId: input.ticketId } });
  if (existing >= 10) throw new Error('Too many attachments (max 10)');

  const buf = Buffer.from(await input.file.arrayBuffer());
  const fileId = crypto.randomUUID();
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
  const key = `support/${input.ticketId}/${fileId}-${safeName}`;

  const stored = await putMediaObject(key, buf, mime || 'application/octet-stream');

  const row = await db.supportAttachment.create({
    data: {
      ticketId: input.ticketId,
      replyId: input.replyId ?? null,
      storageKey: stored.key,
      fileName: input.file.name.slice(0, 160),
      mimeType: mime || 'application/octet-stream',
      bytes: stored.bytes,
      uploadedById: caller.id,
    } as never,
    select: { id: true, storageKey: true, fileName: true, mimeType: true, bytes: true, createdAt: true },
  });

  return row;
}

export async function listTicketAttachments(ticketId: string) {
  await requireOperator();
  return db.supportAttachment.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, fileName: true, mimeType: true, bytes: true, storageKey: true, replyId: true, createdAt: true, uploadedById: true },
  });
}
