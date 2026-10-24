/**
 * POST /api/ai/assistant — ответ ИИ-ассистента клиенту.
 *
 * **Только для вошедших.** Ассистент видит личные брони клиента, поэтому гард
 * стоит до любой работы с данными. Анонимному посетителю не нужен ответ, который
 * стоит денег на каждый вызов модели.
 *
 * **Лимит до работы.** Проверка `assistantChat` идёт раньше разбора тела и
 * запроса к базе: отклонённый запрос не должен ни считать снимок, ни звать модель.
 *
 * **Ответ — JSON, не поток.** Клиент показывает ответ с анимацией появления, а
 * потоковый протокол на React Native добавил бы сложность без выигрыша в UX.
 *
 * **Ошибки — машинные коды.** Текст для человека выбирает клиент по своей локали.
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { getServerEnv } from '@/config/env';
import { getCaller } from '@/lib/auth/guards';
import { loadKnowledgeText, loadPersonalContext } from '@/lib/ai/assistant/knowledge';
import { buildSystemPrompt } from '@/lib/ai/assistant/prompt';
import { checkRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_MODEL_ID = 'gemini-3.6-flash';
const MODEL_TIMEOUT_MS = 25_000;
const MAX_OUTPUT_TOKENS = 900;

const requestSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().trim().min(1).max(2000),
        }),
      )
      .min(1)
      .max(20),
  })
  .refine((body) => body.messages[body.messages.length - 1]?.role === 'user', {
    message: 'last_message_must_be_user',
  });

type ErrorCode = 'unauthenticated' | 'rate_limited' | 'invalid_request' | 'assistant_unavailable';

function jsonResponse(body: object, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl.none,
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function errorResponse(code: ErrorCode, status: number, extra: object = {}, headers: Record<string, string> = {}) {
  return jsonResponse({ error: code, ...extra }, status, headers);
}

export async function POST(request: Request): Promise<NextResponse> {
  const caller = await getCaller();
  if (!caller) return errorResponse('unauthenticated', 401);

  const limit = await checkRateLimit('assistantChat', caller.id);
  if (!limit.allowed) {
    return errorResponse(
      'rate_limited',
      429,
      { retryAfterSeconds: limit.retryAfterSeconds },
      rateLimitHeaders(limit, 'assistantChat'),
    );
  }

  const env = getServerEnv();
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return errorResponse('assistant_unavailable', 503);

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse('invalid_request', 400);

  const now = new Date();

  try {
    const [knowledge, personal] = await Promise.all([
      loadKnowledgeText(caller.locale, now),
      loadPersonalContext(caller.id, caller.locale, now),
    ]);

    const system = buildSystemPrompt({
      locale: caller.locale,
      userName: caller.name ?? null,
      knowledge,
      personal,
    });

    const google = createGoogleGenerativeAI({ apiKey });
    const { text } = await generateText({
      model: google(env.GEMINI_MODEL || DEFAULT_MODEL_ID),
      system,
      messages: parsed.data.messages,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });

    const reply = text.trim();
    if (!reply) return errorResponse('assistant_unavailable', 503);

    return jsonResponse({ reply }, 200, { 'X-RateLimit-Remaining': String(limit.remaining) });
  } catch (error) {
    console.error('[ai-assistant] generation failed', error);
    return errorResponse('assistant_unavailable', 503);
  }
}
