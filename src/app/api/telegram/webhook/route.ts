import { NextResponse } from 'next/server';

import { getServerEnv } from '@/config/env';
import { translateForSnapshot } from '@/i18n/snapshot';
import { handleTelegramCommand } from '@/server/bot/handler';
import { tgIsAllowed, tgSendMessage, tgSetMyCommands } from '@/server/bot/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function secretOk(request: Request, expected: string | undefined): boolean {
  if (!expected) return true;
  const got = request.headers.get('x-telegram-bot-api-secret-token') ?? request.headers.get('x-telegram-webhook-secret') ?? '';
  if (!got) return false;
  // constant-time-ish
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i += 1) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request): Promise<NextResponse> {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }

  const token = env.TELEGRAM_BOT_TOKEN;
  const allowed = env.TELEGRAM_CHAT_ID;
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;

  if (!token || !allowed) return json({ ok: false, error: 'telegram bot not configured' }, 503);
  if (!secretOk(request, webhookSecret)) return json({ ok: false, error: 'bad webhook secret' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: true });
  }

  const msg = (body as { message?: { text?: string; chat?: { id?: number | string }; from?: { id?: number } } })?.message;
  const text = typeof msg?.text === 'string' ? msg.text : '';
  const chatId = msg?.chat?.id;

  if (!text || chatId === undefined) return json({ ok: true });
  if (!tgIsAllowed(chatId, allowed)) {
    // тихо игнорируем чужие чаты, но отвечаем 200 чтобы Telegram не ретраил
    return json({ ok: true });
  }

  const lower = text.trim().toLowerCase();

  // /start — первая встреча: welcome + устанавливаем меню команд (идемпотентно, ок повторно)
  if (lower === '/start' || lower === 'start') {
    try {
      await tgSetMyCommands(token);
    } catch {
      // non-fatal: бот всё ещё отвечает текстом
    }
    try {
      const welcome = translateForSnapshot('ru', 'bot.welcome');
      await tgSendMessage(token, String(chatId), welcome, { parseMode: 'Markdown' });
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  // help / status / repo / ask / task / plain text
  let reply: string;
  try {
    reply = await handleTelegramCommand(text);
  } catch (e) {
    reply = `❌ Ошибка: ${e instanceof Error ? e.message : String(e)}`.slice(0, 3800);
  }

  try {
    await tgSendMessage(token, String(chatId), reply, { parseMode: 'Markdown' });
  } catch {
    // Markdown может упасть на спецсимволах — шлём plain как fallback
    try {
      await tgSendMessage(token, String(chatId), reply, { parseMode: undefined });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  return json({ ok: true });
}

export async function GET(): Promise<NextResponse> {
  return json({ ok: true, hint: 'POST Telegram webhook here' });
}
