'use server';

import { z } from 'zod';

import { authedAction } from '@/server/safe-action';
import { mergeGuestFavorites, toggleFavorite, type FavoriteTarget } from '@/server/favorites/service';

export const toggleFavoriteAction = authedAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ target: z.enum(['class', 'instructor', 'venue', 'product']), slug: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    return toggleFavorite({ userId: ctx.caller.id, target: parsedInput.target as FavoriteTarget, slug: parsedInput.slug });
  });

const guestItemSchema = z.object({ target: z.enum(['class', 'instructor', 'venue', 'product']), slug: z.string().min(1) });

export const mergeGuestFavoritesAction = authedAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ items: z.array(guestItemSchema).max(100) }))
  .action(async ({ parsedInput, ctx }) => {
    return mergeGuestFavorites({ userId: ctx.caller.id, items: parsedInput.items });
  });
