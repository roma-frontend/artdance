'use server';

import { z } from 'zod';

import { danceStyles } from '@/domain/enums';
import { db } from '@/lib/db';
import { publicAction } from '@/server/safe-action';

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(20).optional(),
  bio: z.string().trim().min(10).max(2000),
  styles: z.array(z.enum(danceStyles as unknown as [string, ...string[]])).min(1),
});

export const applyInstructorAction = publicAction
  .metadata({ rateLimit: 'contactForm' })
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx }) => {
    const created = await db.instructorApplication.create({
      data: {
        name: parsedInput.name,
        email: parsedInput.email,
        phone: parsedInput.phone ?? '',
        bio: parsedInput.bio,
        styles: parsedInput.styles as never,
        status: 'PENDING',
      },
      select: { id: true },
    });

    const { recordAudit } = await import('@/lib/audit');
    await recordAudit({
      actor: null,
      action: 'public.instructor.apply',
      entityType: 'InstructorApplication',
      entityId: created.id,
      after: { name: parsedInput.name, email: parsedInput.email, styles: parsedInput.styles },
      ipAddress: ctx.identifier,
    }).catch(() => {
      /* best effort — форма уже сохранена */
    });

    // Подтверждение заявителю — best effort, без блокировки формы.
    void Promise.resolve().then(async () => {
      try {
        const { loadMessages } = await import('@/i18n/messages');
        const messages = await loadMessages('ru');
        const { sendEmail } = await import('@/lib/email/send');
        await sendEmail({
          to: parsedInput.email,
          subject: messages.footer.applicationSent,
          heading: messages.footer.applicationSent,
          paragraphs: [messages.footer.applyHint],
          locale: 'ru',
        });
      } catch {
        /* сеть или отсутствие ключа — не ошибка заявки */
      }
    });

    return { ok: true as const };
  });
