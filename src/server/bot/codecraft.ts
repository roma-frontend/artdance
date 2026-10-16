import 'server-only';

import { getServerEnv } from '@/config/env';

export interface CodecraftMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CodecraftCallOptions {
  messages: CodecraftMessage[];
  maxTokens?: number;
}

export async function codecraftChat(opts: CodecraftCallOptions): Promise<string> {
  const env = getServerEnv();
  const base = (env.CODECRAFT_BASE_URL ?? '').replace(/\/$/, '');
  const key = env.CODECRAFT_API_KEY;
  const model = env.CODECRAFT_MODEL ?? 'claude-opus-5.5';
  if (!base || !key) throw new Error('CodeCraft not configured: CODECRAFT_BASE_URL / CODECRAFT_API_KEY missing');

  const url = `${base}/chat/completions`;
  // Cloudflare Turnstile на Vercel IP режет Bearer — шлём оба варианта
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    authorization: `Bearer ${key}`,
    'x-api-key': key,
    'user-agent': 'ArtDanceBot/1.0 (Vercel; +https://artdance.vercel.app)',
    'anthropic-version': '2023-06-01',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1600,
      temperature: 0.2,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`codecraft ${res.status}: ${text.slice(0, 900)}`);
  let j: unknown;
  try {
    j = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`codecraft invalid json: ${text.slice(0, 900)}`);
  }
  const choice = (j as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
  if (typeof choice === 'string' && choice.trim()) return choice;
  // fallback: some gateways return { output: ... } or { text: ... }
  const alt = (j as Record<string, unknown>).output ?? (j as Record<string, unknown>).text;
  if (typeof alt === 'string') return alt;
  return JSON.stringify(j).slice(0, 4000);
}

export function codecraftConfigured(): boolean {
  try {
    const env = getServerEnv();
    return Boolean(env.CODECRAFT_BASE_URL && env.CODECRAFT_API_KEY);
  } catch {
    return false;
  }
}
