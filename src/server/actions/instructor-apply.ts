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
  .action(async ({ parsedInput }) => {
    await db.instructorApplication.create({
      data: {
        name: parsedInput.name,
        email: parsedInput.email,
        phone: parsedInput.phone ?? '',
        bio: parsedInput.bio,
        styles: parsedInput.styles as never,
        status: 'PENDING',
      },
    });
    return { ok: true as const };
  });
