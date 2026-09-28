import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import {
  addCartItem,
  applyPromoCode,
  getCartSnapshot,
  removeCartItem,
  removePromoCode,
  updateCartItem,
  validateCart,
} from '@/server/cart/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const anonHeader = 'x-anonymous-id';

function anonFrom(req: Request): string | null {
  const v = req.headers.get(anonHeader);
  return v && v.length >= 8 ? v : null;
}

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

function errorFromDomain(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
  console.error('[cart]', error);
  return json({ error: 'INTERNAL' }, 500);
}

export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    const snapshot = await getCartSnapshot({ userId: caller?.id ?? null, anonymousId: anonFrom(request) });
    return json({ snapshot }, 200);
  } catch (e) {
    return errorFromDomain(e);
  }
}

const addSchema = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).optional() });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED' }, 400);
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED' }, 400);
  try {
    const caller = await getCaller();
    const snapshot = await addCartItem({ userId: caller?.id ?? null, anonymousId: anonFrom(request), variantId: parsed.data.variantId, quantity: parsed.data.quantity });
    return json({ snapshot }, 200);
  } catch (e) {
    return errorFromDomain(e);
  }
}

const patchSchema = z.object({ itemId: z.string().min(1), quantity: z.number().int() });

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED' }, 400);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED' }, 400);
  try {
    const caller = await getCaller();
    const snapshot = await updateCartItem({ userId: caller?.id ?? null, anonymousId: anonFrom(request), itemId: parsed.data.itemId, quantity: parsed.data.quantity });
    return json({ snapshot }, 200);
  } catch (e) {
    return errorFromDomain(e);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const itemId = url.searchParams.get('itemId');
  const codeOp = url.searchParams.get('op');
  try {
    const caller = await getCaller();
    if (codeOp === 'removePromo') {
      const snapshot = await removePromoCode({ userId: caller?.id ?? null, anonymousId: anonFrom(request) });
      return json({ snapshot }, 200);
    }
    if (codeOp === 'validate') {
      const snapshot = await validateCart({ userId: caller?.id ?? null, anonymousId: anonFrom(request) });
      return json({ snapshot }, 200);
    }
    if (!itemId) return json({ error: 'VALIDATION_FAILED' }, 400);
    const snapshot = await removeCartItem({ userId: caller?.id ?? null, anonymousId: anonFrom(request), itemId });
    return json({ snapshot }, 200);
  } catch (e) {
    return errorFromDomain(e);
  }
}

const promoSchema = z.object({ code: z.string().min(1) });

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED' }, 400);
  }
  const parsed = promoSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED' }, 400);
  try {
    const caller = await getCaller();
    const snapshot = await applyPromoCode({ userId: caller?.id ?? null, anonymousId: anonFrom(request), code: parsed.data.code });
    return json({ snapshot }, 200);
  } catch (e) {
    return errorFromDomain(e);
  }
}
