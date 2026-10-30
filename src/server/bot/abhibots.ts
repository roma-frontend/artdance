import 'server-only';

import { getServerEnv } from '@/config/env';

export interface AbhibotsMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AbhibotsCallOptions {
  messages: AbhibotsMessage[];
  maxTokens?: number;
}

/**
 * ABHIBOTS (opus.abhibots.com) — прокси к Anthropic.
 * Эндпоинт: POST {base}/messages, базовый URL = .../v1
 * Аутентификация: x-api-key + anthropic-version (не Bearer).
 */
export async function abhibotsChat(opts: AbhibotsCallOptions): Promise<string> {
  const env = getServerEnv();
  const base = (env.ABHIBOTS_BASE_URL ?? '').replace(/\/$/, '');
  const key = env.ABHIBOTS_API_KEY;
  const model = env.ABHIBOTS_MODEL ?? 'claude-opus-5-5';
  if (!base || !key) throw new Error('ABHIBOTS not configured: ABHIBOTS_BASE_URL / ABHIBOTS_API_KEY missing');

  // Сепаруем system-сообщения от user/assistant (Anthropic API требует отдельного system-поля)
  const systemMsg = opts.messages.find((m) => m.role === 'system');
  const nonSystem = opts.messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 1600,
    messages: nonSystem,
  };
  if (systemMsg?.content) body.system = systemMsg.content;

  const res = await fetch(`${base}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`abhibots ${res.status}: ${text.slice(0, 900)}`);

  let j: unknown;
  try {
    j = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`abhibots invalid json: ${text.slice(0, 900)}`);
  }

  // Anthropic: content — массив блоков { type: 'text', text: '...' }
  const raw = j as { content?: Array<{ type?: string; text?: string }> };
  const textBlock = raw.content?.find((b) => b.type === 'text');
  if (typeof textBlock?.text === 'string' && textBlock.text.trim()) return textBlock.text;

  // Fallback: plain string content
  const alt = (j as Record<string, unknown>).text;
  if (typeof alt === 'string') return alt;
  return JSON.stringify(j).slice(0, 4000);
}

export function abhibotsConfigured(): boolean {
  try {
    const env = getServerEnv();
    return Boolean(env.ABHIBOTS_BASE_URL && env.ABHIBOTS_API_KEY);
  } catch {
    return false;
  }
}
