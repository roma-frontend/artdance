import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import type { Locale } from '@/lib/i18n';

const LOCALE_KEY = 'artdance.locale';
const LOCALES: readonly Locale[] = ['hy', 'ru', 'en'];
const isWeb = Platform.OS === 'web';

let chosen: Locale | null = null;
const listeners = new Set<() => void>();

function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

function systemLocale(): Locale {
  const code = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase();
  return isLocale(code) ? code : 'ru';
}

function publish(next: Locale): void {
  chosen = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* Язык, выбранный пользователем в приложении; без выбора берется язык устройства. */
export function currentLocale(): Locale {
  return chosen ?? systemLocale();
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, currentLocale, currentLocale);
}

export async function loadLocale(): Promise<void> {
  const stored = isWeb ? globalThis.localStorage?.getItem(LOCALE_KEY) : await SecureStore.getItemAsync(LOCALE_KEY);
  if (isLocale(stored)) publish(stored);
}

export async function chooseLocale(next: Locale): Promise<void> {
  if (isWeb) globalThis.localStorage?.setItem(LOCALE_KEY, next);
  else await SecureStore.setItemAsync(LOCALE_KEY, next);
  publish(next);
}
