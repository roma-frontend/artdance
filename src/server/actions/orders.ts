'use server';

import { z } from 'zod';

import { getCaller } from '@/lib/auth/guards';
import { publicAction } from '@/server/safe-action';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { createOrder, transitionOrder } from '@/server/orders/service';

export const createOrderAction = publicAction
  .metadata({ rateLimit: 'paymentIntent' })
  .inputSchema(
    z.object({
      contactEmail: z.string().email(),
      contactPhone: z.string().min(6),
      contactName: z.string().min(1),
      deliveryMethod: z.enum(['COURIER', 'PICKUP_POINT']).optional().nullable(),
      deliveryAddressId: z.string().optional().nullable(),
      deliveryAddress: z
        .object({
          street: z.string().trim().min(1).max(200),
          city: z.string().trim().min(1).max(120),
          postalCode: z.string().trim().max(20).optional().nullable(),
        })
        .optional()
        .nullable(),
      deliveryNotes: z.string().max(500).optional().nullable(),
      pickupPointCode: z.string().optional().nullable(),
      anonymousId: z.string().min(8).max(128).optional().nullable(),
    }),
  )
  .action(async ({ parsedInput }) => {
    /*
     * Заказ магазина закрыт тумблером здесь, а не только на страницах: `/cart`
     * и `/checkout` отдают 404, но действие вызывается напрямую, и без этой
     * проверки выключенный магазин продолжал бы принимать заказы.
     */
    await assertEntitlementOrThrow('shop');
    const caller = await getCaller();
    return createOrder({
      userId: caller?.id ?? null,
      anonymousId: parsedInput.anonymousId ?? null,
      contactEmail: parsedInput.contactEmail,
      contactPhone: parsedInput.contactPhone,
      contactName: parsedInput.contactName,
      deliveryMethod: parsedInput.deliveryMethod ?? null,
      deliveryAddressId: parsedInput.deliveryAddressId ?? null,
      deliveryAddress: parsedInput.deliveryAddress ?? null,
      deliveryNotes: parsedInput.deliveryNotes ?? null,
      pickupPointCode: parsedInput.pickupPointCode ?? null,
    });
  });

export const transitionOrderAction = publicAction
  .metadata({ rateLimit: 'adminMutation' })
  .inputSchema(z.object({ orderId: z.string().min(1), to: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    const { requireCapability } = await import('@/lib/auth/guards');
    await requireCapability('orders.fulfil');
    return transitionOrder({ orderId: parsedInput.orderId, to: parsedInput.to });
  });
