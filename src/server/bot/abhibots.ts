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

export async function abhibotsChat(opts: AbhibotsCallOptions): Promise<string> {
  const env = getServerEnv();
  const base = (env.ABHIBOTS_BASE_URL ?? '').replace(/\/$/, '');
  const key = env.ABHIBOTS_API_KEY;
  const model = env.ABHIBOTS_MODEL ?? 'gpt-5.5';
  if (!base || !key) throw new Error('ABHIBOTS not configured: ABHIBOTS_BASE_URL / ABHIBOTS_API_KEY missing');

  const url = `${base}/chat/completions`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    authorization: `Bearer ${key}`,
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
  if (!res.ok) throw new Error(`abhibots ${res.status}: ${text.slice(0, 900)}`);
  let j: unknown;
  try {
    j = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`abhibots invalid json: ${text.slice(0, 900)}`);
  }
  const choice = (j as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
  if (typeof choice === 'string' && choice.trim()) return choice;
  const alt = (j as Record<string, unknown>).output ?? (j as Record<string, unknown>).text;
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
