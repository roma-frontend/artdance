'use server';

import { instructorApplicationSchema } from '@/domain/instructor-application';
import { publicAction } from '@/server/safe-action';
import { submitInstructorApplication } from '@/server/instructor-application/service';

export const applyInstructorAction = publicAction
  .metadata({ rateLimit: 'contactForm' })
  .inputSchema(instructorApplicationSchema)
  .action(async ({ parsedInput, ctx }) => {
    await submitInstructorApplication({
      fields: parsedInput,
      documents: [],
      ipAddress: ctx.identifier,
    });

    return { ok: true as const };
  });
