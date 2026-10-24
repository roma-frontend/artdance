import 'server-only';

import { randomUUID } from 'node:crypto';

import {
  documentExtension,
  type ApplicationDocumentKind,
  type DocumentMime,
  type InstructorApplicationInput,
} from '@/domain/instructor-application';
import { db } from '@/lib/db';
import { deletePrivateObject, putPrivateObject } from '@/lib/media/storage';

export interface ApplicationDocumentUpload {
  kind: ApplicationDocumentKind;
  mime: DocumentMime;
  data: Buffer;
}

/** Метаданные документа в `InstructorApplication.payload`. Сам файл лежит в приватном хранилище. */
type StoredApplicationDocument = {
  kind: ApplicationDocumentKind;
  key: string;
  mime: DocumentMime;
  bytes: number;
  uploadedAt: string;
};

/**
 * Создаёт заявку исполнителя. Документы пишутся в приватное хранилище до строки в БД;
 * если запись не удалась, уже загруженные файлы удаляются, чтобы не копить сироты.
 */
export async function submitInstructorApplication(input: {
  fields: InstructorApplicationInput;
  documents: readonly ApplicationDocumentUpload[];
  ipAddress: string;
}): Promise<{ id: string }> {
  const { fields, documents, ipAddress } = input;
  const id = randomUUID();
  const stored: StoredApplicationDocument[] = [];

  try {
    for (const document of documents) {
      const key = `instructor-applications/${id}/${randomUUID()}.${documentExtension(document.mime)}`;
      await putPrivateObject(key, document.data, document.mime);
      stored.push({
        kind: document.kind,
        key,
        mime: document.mime,
        bytes: document.data.byteLength,
        uploadedAt: new Date().toISOString(),
      });
    }

    await db.instructorApplication.create({
      data: {
        id,
        name: fields.name,
        email: fields.email,
        phone: fields.phone ?? '',
        bio: fields.bio,
        styles: fields.styles as never,
        status: 'PENDING',
        ...(stored.length > 0 ? { payload: { documents: stored } as never } : {}),
      },
      select: { id: true },
    });
  } catch (error) {
    await Promise.all(stored.map((document) => deletePrivateObject(document.key).catch(() => undefined)));
    throw error;
  }

  const { recordAudit } = await import('@/lib/audit');
  await recordAudit({
    actor: null,
    action: 'public.instructor.apply',
    entityType: 'InstructorApplication',
    entityId: id,
    after: { name: fields.name, email: fields.email, styles: fields.styles, documents: stored.length },
    ipAddress,
  }).catch(() => {
    /* best effort — заявка уже сохранена */
  });

  // Подтверждение заявителю — best effort, без блокировки ответа.
  void Promise.resolve().then(async () => {
    try {
      const { loadMessages } = await import('@/i18n/messages');
      const messages = await loadMessages('ru');
      const { sendEmail } = await import('@/lib/email/send');
      await sendEmail({
        to: fields.email,
        subject: messages.footer.applicationSent,
        heading: messages.footer.applicationSent,
        paragraphs: [messages.footer.applyHint],
        locale: 'ru',
      });
    } catch {
      /* сеть или отсутствие ключа — не ошибка заявки */
    }
  });

  return { id };
}
