import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'artdance.session_token';
const HINT_KEY = 'artdance.hint.catalog_seen';

/*
 * На телефоне токен лежит в SecureStore (Keychain / Keystore). В браузере SecureStore
 * недоступен, поэтому там используется localStorage. Это только для просмотра в браузере.
 */
const isWeb = Platform.OS === 'web';

export async function getSessionToken(): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getHintSeen(): Promise<boolean> {
  if (isWeb) return globalThis.localStorage?.getItem(HINT_KEY) === '1';
  return (await SecureStore.getItemAsync(HINT_KEY)) === '1';
}

export async function setHintSeen(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(HINT_KEY, '1');
    return;
  }
  await SecureStore.setItemAsync(HINT_KEY, '1');
}

export async function clearSessionToken(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
