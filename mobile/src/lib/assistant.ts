import { API_URL } from './config';
import { getSessionToken } from './session';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };

export type AssistantErrorCode = 'unauthorized' | 'rate_limited' | 'unavailable' | 'network';

export class AssistantError extends Error {
  constructor(
    readonly code: AssistantErrorCode,
    readonly status = 0,
  ) {
    super(code);
  }
}

/** Чуть больше серверного таймаута модели, чтобы не обрывать ответ, который уже считается. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Ответ ассистента на историю диалога. Личность и данные определяет сервер по bearer-токену. */
export async function askAssistant(messages: AssistantMessage[]): Promise<string> {
  const token = await getSessionToken();
  if (!token) throw new AssistantError('unauthorized', 401);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/ai/assistant`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
  } catch {
    throw new AssistantError('network');
  } finally {
    clearTimeout(timer);
  }

  const body = (await response.json().catch(() => null)) as { reply?: unknown } | null;
  if (response.ok && typeof body?.reply === 'string') return body.reply;
  if (response.status === 401) throw new AssistantError('unauthorized', 401);
  if (response.status === 429) throw new AssistantError('rate_limited', 429);
  throw new AssistantError('unavailable', response.status);
}
