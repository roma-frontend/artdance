'use server';

import { z } from 'zod';

import { authedAction } from '@/server/safe-action';
import { toggleFavorite, type FavoriteTarget } from '@/server/favorites/service';

export const toggleFavoriteAction = authedAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ target: z.enum(['class', 'instructor', 'venue', 'product']), slug: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    return toggleFavorite({ userId: ctx.caller.id, target: parsedInput.target as FavoriteTarget, slug: parsedInput.slug });
  });
