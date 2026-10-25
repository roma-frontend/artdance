import { API_URL } from './config';
import { getSessionToken } from './session';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };

/** Предложение записать на групповое занятие; подтверждает клиент, сервер не бронирует сам. */
export type AssistantBookAction = {
  type: 'book';
  sessionId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  spotsLeft: number;
};

export type AssistantAction = AssistantBookAction;

export type AssistantReply = { reply: string; actions: AssistantAction[] };

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

function isBookAction(value: unknown): value is AssistantBookAction {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    item.type === 'book' &&
    typeof item.sessionId === 'string' &&
    typeof item.title === 'string' &&
    typeof item.startsAt === 'string' &&
    typeof item.endsAt === 'string' &&
    typeof item.spotsLeft === 'number'
  );
}

/** Ответ ассистента на историю диалога. Личность и данные определяет сервер по bearer-токену. */
export async function askAssistant(messages: AssistantMessage[]): Promise<AssistantReply> {
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

  const body = (await response.json().catch(() => null)) as { reply?: unknown; actions?: unknown } | null;
  if (response.ok && typeof body?.reply === 'string') {
    const actions = Array.isArray(body.actions) ? body.actions.filter(isBookAction) : [];
    return { reply: body.reply, actions };
  }
  if (response.status === 401) throw new AssistantError('unauthorized', 401);
  if (response.status === 429) throw new AssistantError('rate_limited', 429);
  throw new AssistantError('unavailable', response.status);
}
