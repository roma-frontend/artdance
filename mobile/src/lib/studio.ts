import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

/** Недельное окно из `AvailabilityRule`. `weekday`: 0 = воскресенье. */
export type ScheduleRule = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
};

/** Разовое исключение: блокировка (`isAvailable: false`) или дополнительное окно (`true`). */
export type ScheduleException = {
  id: string;
  startsAt: string;
  endsAt: string;
  isAvailable: boolean;
  reason: string | null;
};

export type AvailabilitySnapshot = {
  rules: ScheduleRule[];
  exceptions: ScheduleException[];
};

export type RuleDraft = {
  weekday: number;
  startTime: string;
  endTime: string;
  validFrom: string;
  validUntil: string;
};

export type ExceptionDraft = {
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason: string;
};

export class StudioError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

const ENDPOINT = `${API_URL}/api/studio/availability`;

/** Ошибка ответа с переведённым текстом сервера, если messageKey есть в словаре приложения. */
async function failureFor(response: Response): Promise<StudioError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new StudioError(`HTTP ${response.status}`, response.status, serverMessage);
}

async function authorizedFetch(init: { method: 'GET' | 'POST'; body?: unknown }): Promise<Response> {
  const token = await getSessionToken();
  if (!token) throw new StudioError('UNAUTHORIZED', 401);
  return fetch(ENDPOINT, {
    method: init.method,
    headers: {
      Accept: 'application/json',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

/** Правила и исключения текущего инструктора. */
export async function getAvailability(): Promise<AvailabilitySnapshot> {
  const response = await authorizedFetch({ method: 'GET' });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as AvailabilitySnapshot;
}

async function mutate(body: unknown): Promise<void> {
  const response = await authorizedFetch({ method: 'POST', body });
  if (!response.ok) throw await failureFor(response);
}

/** Добавляет или меняет недельное окно. Пустые даты означают «без ограничения». */
export function saveRule(draft: RuleDraft): Promise<void> {
  return mutate({
    op: 'saveRule',
    rule: {
      weekday: draft.weekday,
      startTime: draft.startTime,
      endTime: draft.endTime,
      validFrom: draft.validFrom,
      validUntil: draft.validUntil,
      isActive: true,
    },
  });
}

/** Добавляет разовое исключение: блокировку или дополнительное окно. */
export function saveException(draft: ExceptionDraft): Promise<void> {
  return mutate({
    op: 'saveException',
    exception: {
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      isAvailable: draft.isAvailable,
      reason: draft.reason,
    },
  });
}

export function deleteEntry(table: 'rule' | 'exception', id: string): Promise<void> {
  return mutate({ op: 'delete', table, id });
}

export function setRuleActive(id: string, isActive: boolean): Promise<void> {
  return mutate({ op: 'toggle', id, isActive });
}
