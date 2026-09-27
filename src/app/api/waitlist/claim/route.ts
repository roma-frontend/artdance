import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { claimWaitlistSlot } from '@/server/booking/service';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const schema = z.object({ sessionId: z.string().min(1) });
function json(b: object,s:number,e: Record<string,string>={}){ return NextResponse.json(b,{status:s, headers:{'Cache-Control':cacheControl.none,'X-Content-Type-Options':'nosniff',...e}});}
export async function POST(request: Request){
  const limit = await checkRateLimit('bookingHold', clientIdentifier(request.headers)); if(!limit.allowed) return json({error:'RATE_LIMITED',messageKey:'errors.rateLimited.description',params:{seconds:limit.retryAfterSeconds}},429,rateLimitHeaders(limit,'bookingHold'));
  let body: unknown; try{ body=await request.json();}catch{ return json({error:'VALIDATION_FAILED',messageKey:'validation.required'},400);}
  const parsed=schema.safeParse(body); if(!parsed.success) return json({error:'VALIDATION_FAILED',messageKey:'validation.required'},400);
  const caller=await requireCaller();
  try{ const hold=await claimWaitlistSlot({ sessionId: parsed.data.sessionId, userId: caller.id, now:new Date()}); return json({ hold:{ id: hold.id, expiresAt: hold.expiresAt.toISOString()} },201); }
  catch(e){ if(isDomainError(e)) return json({error:e.code,messageKey:e.messageKey,params:e.params},httpStatusFor(e.code)); console.error('[waitlist/claim]',e); return json({error:'INTERNAL',messageKey:'errors.generic.description'},500);}
}
