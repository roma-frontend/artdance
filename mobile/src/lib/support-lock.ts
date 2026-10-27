import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'support.pin.hash';
const PIN_SALT_KEY = 'support.pin.salt';
const FAILS_KEY = 'support.pin.fails';
const LOCKED_UNTIL_KEY = 'support.pin.lockedUntil';

export const PIN_LENGTH = 6;
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function hasPin(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PIN_HASH_KEY)) !== null;
}

export async function setPin(pin: string): Promise<void> {
  const salt = toHex(Crypto.getRandomBytes(16));
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, await hashPin(pin, salt));
  await SecureStore.deleteItemAsync(FAILS_KEY);
  await SecureStore.deleteItemAsync(LOCKED_UNTIL_KEY);
}

/** Оставшееся время временной блокировки после серии неверных PIN, мс. */
export async function lockoutRemainingMs(): Promise<number> {
  const raw = await SecureStore.getItemAsync(LOCKED_UNTIL_KEY);
  if (!raw) return 0;
  return Math.max(0, Number(raw) - Date.now());
}

export async function verifyPin(pin: string): Promise<'ok' | 'wrong' | 'locked'> {
  if (await lockoutRemainingMs()) return 'locked';

  const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
  const stored = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!salt || !stored) return 'wrong';

  if ((await hashPin(pin, salt)) === stored) {
    await SecureStore.deleteItemAsync(FAILS_KEY);
    return 'ok';
  }

  const fails = Number((await SecureStore.getItemAsync(FAILS_KEY)) ?? '0') + 1;
  if (fails >= MAX_FAILS) {
    await SecureStore.setItemAsync(LOCKED_UNTIL_KEY, String(Date.now() + LOCK_MS));
    await SecureStore.deleteItemAsync(FAILS_KEY);
    return 'locked';
  }
  await SecureStore.setItemAsync(FAILS_KEY, String(fails));
  return 'wrong';
}

export async function biometricAvailable(): Promise<boolean> {
  const [hardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  return hardware && enrolled;
}

export type BiometricOutcome = 'ok' | 'cancelled' | 'failed';

/** Без запасного варианта устройства: вход возможен только по биометрии или PIN приложения. */
export async function authenticateBiometric(promptMessage: string): Promise<BiometricOutcome> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: true });
    if (result.success) return 'ok';
    const cancelled = result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel';
    return cancelled ? 'cancelled' : 'failed';
  } catch {
    return 'failed';
  }
}
