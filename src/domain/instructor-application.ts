/**
 * Заявка исполнителя: схема полей и правила документов.
 *
 * Общая для веба (server action) и мобильного API, чтобы правила не разъехались.
 * Документы проверяются по сигнатуре файла: `Content-Type` от клиента — это
 * утверждение, а не факт, и заявитель может подписать `.exe` как `application/pdf`.
 */

import { z } from 'zod';

import { danceStyles } from '@/domain/enums';

export const instructorApplicationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(20).optional(),
  bio: z.string().trim().min(10).max(2000),
  styles: z.array(z.enum(danceStyles as unknown as [string, ...string[]])).min(1),
});

export type InstructorApplicationInput = z.infer<typeof instructorApplicationSchema>;

/** Какой документ приложен. Нужен модератору, чтобы понять, что перед ним. */
export const applicationDocumentKinds = ['identity', 'diploma', 'certificate'] as const;
export type ApplicationDocumentKind = (typeof applicationDocumentKinds)[number];

export function isApplicationDocumentKind(value: string): value is ApplicationDocumentKind {
  return (applicationDocumentKinds as readonly string[]).includes(value);
}

export const applicationDocumentPolicy = {
  maxBytes: 10 * 1024 * 1024,
  maxCount: 5,
  minCount: 1,
} as const;

export type DocumentMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

const documentExtensions: Record<DocumentMime, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function documentExtension(mime: DocumentMime): string {
  return documentExtensions[mime];
}

function startsWithAt(data: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (data.length < offset + signature.length) return false;
  return signature.every((byte, index) => data[offset + index] === byte);
}

/**
 * Определяет формат по первым байтам. Возвращает `null`, если файл не похож ни на один
 * из разрешённых форматов: тогда он не принимается, каким бы ни был заголовок.
 */
export function sniffDocumentMime(data: Uint8Array): DocumentMime | null {
  if (startsWithAt(data, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (startsWithAt(data, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWithAt(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWithAt(data, [0x52, 0x49, 0x46, 0x46]) && startsWithAt(data, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  return null;
}
