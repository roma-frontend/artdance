import { ApiError, apiRequest } from './api-client';

/**
 * Безопасность аккаунта: устройства с открытой сессией, выход с остальных и резервные коды.
 * Маршруты — встроенные в Better Auth; Bearer-токен принимается так же, как у остального API.
 */

export type DeviceSession = {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export function listDeviceSessions() {
  return apiRequest<DeviceSession[]>('/api/auth/list-sessions');
}

export function signOutOtherDevices() {
  return apiRequest('/api/auth/revoke-other-sessions', { method: 'POST', body: {} });
}

/**
 * Новые резервные коды. Неверный пароль Better Auth отвечает 400 или 401 без `messageKey`,
 * поэтому такой ответ экран переводит сам; остальные ошибки идут общим текстом.
 */
export async function generateBackupCodes(password: string): Promise<string[]> {
  try {
    const result = await apiRequest<{ backupCodes: string[] }>('/api/auth/two-factor/generate-backup-codes', {
      method: 'POST',
      body: { password },
    });
    return result.backupCodes;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
      throw new WrongPasswordError();
    }
    throw error;
  }
}

export class WrongPasswordError extends Error {
  constructor() {
    super('WRONG_PASSWORD');
    this.name = 'WrongPasswordError';
  }
}
