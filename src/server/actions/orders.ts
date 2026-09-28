'use server';

import { z } from 'zod';

import { getCaller } from '@/lib/auth/guards';
import { publicAction } from '@/server/safe-action';
import { createOrder, transitionOrder } from '@/server/orders/service';

export const createOrderAction = publicAction
  .metadata({ rateLimit: 'search' })
  .inputSchema(
    z.object({
      contactEmail: z.string().email(),
      contactPhone: z.string().min(6),
      contactName: z.string().min(1),
      deliveryMethod: z.enum(['COURIER', 'PICKUP_POINT']).optional().nullable(),
      deliveryAddressId: z.string().optional().nullable(),
      deliveryNotes: z.string().optional().nullable(),
      pickupPointCode: z.string().optional().nullable(),
      anonymousId: z.string().min(8).max(128).optional().nullable(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const caller = await getCaller();
    return createOrder({
      userId: caller?.id ?? null,
      anonymousId: parsedInput.anonymousId ?? null,
      contactEmail: parsedInput.contactEmail,
      contactPhone: parsedInput.contactPhone,
      contactName: parsedInput.contactName,
      deliveryMethod: parsedInput.deliveryMethod ?? null,
      deliveryAddressId: parsedInput.deliveryAddressId ?? null,
      deliveryNotes: parsedInput.deliveryNotes ?? null,
      pickupPointCode: parsedInput.pickupPointCode ?? null,
    });
  });

export const transitionOrderAction = publicAction
  .metadata({ rateLimit: 'adminMutation' })
  .inputSchema(z.object({ orderId: z.string().min(1), to: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    return transitionOrder({ orderId: parsedInput.orderId, to: parsedInput.to });
  });
