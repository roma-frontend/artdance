import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STEP_KEY = 'artdance.onboarding.step';
const SNOOZE_KEY = 'artdance.onboarding.snoozed_until';
/** «Позже» откладывает тур на неделю, а не навсегда. */
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const isWeb = Platform.OS === 'web';

async function read(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string | null): Promise<void> {
  if (isWeb) {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

/** Шаг, на котором тур прервали; null — начать сначала. */
export async function loadOnboardingStep(): Promise<number | null> {
  const raw = await read(STEP_KEY).catch(() => null);
  const step = raw === null ? NaN : Number(raw);
  return Number.isInteger(step) && step >= 0 ? step : null;
}

export function saveOnboardingStep(step: number): Promise<void> {
  return write(STEP_KEY, String(step)).catch(() => undefined);
}

export async function snoozeOnboarding(): Promise<void> {
  await write(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)).catch(() => undefined);
}

export async function isOnboardingSnoozed(now = Date.now()): Promise<boolean> {
  const raw = await read(SNOOZE_KEY).catch(() => null);
  return raw !== null && Number(raw) > now;
}

/** Тур пройден: прогресс и отсрочка больше не нужны. */
export async function clearOnboardingProgress(): Promise<void> {
  await Promise.all([write(STEP_KEY, null), write(SNOOZE_KEY, null)]).catch(() => undefined);
}
