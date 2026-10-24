/**
 * API: POST /api/instructor-applications — заявка исполнителя из мобильного приложения.
 *
 * Тело — `multipart/form-data`:
 * - `name`, `email`, `phone`, `bio`, повторяемое `styles`;
 * - `documents` (файлы) и `documentKinds` (вид каждого файла, в том же порядке).
 *
 * Документы уходят в приватное хранилище и не отдаются ни одним публичным маршрутом.
 * Анонимная форма, поэтому лимит считается по клиенту, как у веб-формы.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import {
  applicationDocumentPolicy,
  instructorApplicationSchema,
  isApplicationDocumentKind,
  sniffDocumentMime,
} from '@/domain/instructor-application';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { submitInstructorApplication, type ApplicationDocumentUpload } from '@/server/instructor-application/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

const MAX_DOCUMENT_MB = applicationDocumentPolicy.maxBytes / (1024 * 1024);

export async function POST(request: Request) {
  const identifier = clientIdentifier(request.headers);
  const limit = await checkRateLimit('contactForm', identifier);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'contactForm'),
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const phone = String(form.get('phone') ?? '').trim();
  const parsed = instructorApplicationSchema.safeParse({
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    phone: phone === '' ? undefined : phone,
    bio: String(form.get('bio') ?? ''),
    styles: form.getAll('styles').map(String),
  });
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  const files = form.getAll('documents');
  const kinds = form.getAll('documentKinds').map(String);
  const { minCount, maxCount, maxBytes } = applicationDocumentPolicy;

  if (files.length < minCount) {
    return json({ error: 'DOCUMENTS_REQUIRED', messageKey: 'instructorApply.errors.documentsRequired' }, 400);
  }
  if (files.length > maxCount) {
    return json(
      { error: 'TOO_MANY_DOCUMENTS', messageKey: 'instructorApply.errors.tooManyDocuments', params: { max: maxCount } },
      400,
    );
  }
  if (kinds.length !== files.length) {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const documents: ApplicationDocumentUpload[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const kind = kinds[index] ?? '';

    if (!(file instanceof File) || !isApplicationDocumentKind(kind)) {
      return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
    }
    if (file.size > maxBytes) {
      return json(
        { error: 'FILE_TOO_LARGE', messageKey: 'instructorApply.errors.fileTooLarge', params: { max: MAX_DOCUMENT_MB } },
        422,
      );
    }

    const data = Buffer.from(await file.arrayBuffer());
    const mime = sniffDocumentMime(data);
    if (!mime) {
      return json({ error: 'UNSUPPORTED_TYPE', messageKey: 'instructorApply.errors.fileType' }, 422);
    }

    documents.push({ kind, mime, data });
  }

  try {
    const { id } = await submitInstructorApplication({ fields: parsed.data, documents, ipAddress: identifier });
    return json({ id }, 201);
  } catch (error) {
    console.error('[instructor-applications]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}
