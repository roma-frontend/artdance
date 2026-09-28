'use server';

import { z } from 'zod';

import { getCaller } from '@/lib/auth/guards';
import { publicAction } from '@/server/safe-action';
import {
  addCartItem,
  applyPromoCode,
  clearCart,
  getCartSnapshot,
  mergeGuestCart,
  removeCartItem,
  removePromoCode,
  updateCartItem,
  validateCart,
} from '@/server/cart/service';

const anonSchema = z.string().min(8).max(128).optional().nullable();

function callerAnon(input: { anonymousId?: string | null } | undefined, anon: string | null | undefined) {
  return input?.anonymousId ?? anon ?? null;
}

export const getCartAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ anonymousId: anonSchema }).optional())
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    return getCartSnapshot({ userId: caller?.id ?? null, anonymousId: callerAnon(parsedInput, parsedInput?.anonymousId ?? null) });
  });

export const addCartItemAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ variantId: z.string().min(1), quantity: z.number().int().optional(), anonymousId: anonSchema }))
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    return addCartItem({
      userId: caller?.id ?? null,
      anonymousId: callerAnon(parsedInput, parsedInput.anonymousId),
      variantId: parsedInput.variantId,
      quantity: parsedInput.quantity,
    });
  });

export const updateCartItemAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ itemId: z.string().min(1), quantity: z.number().int(), anonymousId: anonSchema }))
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    return updateCartItem({
      userId: caller?.id ?? null,
      anonymousId: callerAnon(parsedInput, parsedInput.anonymousId),
      itemId: parsedInput.itemId,
      quantity: parsedInput.quantity,
    });
  });

export const removeCartItemAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ itemId: z.string().min(1), anonymousId: anonSchema }))
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    return removeCartItem({ userId: caller?.id ?? null, anonymousId: callerAnon(parsedInput, parsedInput.anonymousId), itemId: parsedInput.itemId });
  });

export const clearCartAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ anonymousId: anonSchema }).optional())
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    return clearCart({ userId: caller?.id ?? null, anonymousId: callerAnon(parsedInput, parsedInput?.anonymousId ?? null) });
  });

export const validateCartAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ anonymousId: anonSchema }).optional())
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    return validateCart({ userId: caller?.id ?? null, anonymousId: callerAnon(parsedInput, parsedInput?.anonymousId ?? null) });
  });

export const applyCartPromoAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ code: z.string().min(1), anonymousId: anonSchema }))
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    return applyPromoCode({ userId: caller?.id ?? null, anonymousId: callerAnon(parsedInput, parsedInput.anonymousId), code: parsedInput.code });
  });

export const removeCartPromoAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ anonymousId: anonSchema }).optional())
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    return removePromoCode({ userId: caller?.id ?? null, anonymousId: callerAnon(parsedInput, parsedInput?.anonymousId ?? null) });
  });

export const mergeGuestCartAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(z.object({ anonymousId: z.string().min(8) }))
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    if (!caller) return null;
    return mergeGuestCart({ userId: caller.id, anonymousId: parsedInput.anonymousId });
  });
