import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'artdance.session_token';
const USER_KEY = 'artdance.session_user';
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

const TRUST_KEY = 'artdance.two_factor_trust';

/*
 * Cookie доверенного устройства (`name=value`). Не удаляется при выходе: устройство остаётся доверенным,
 * пока не очищены данные приложения. Как и в вебе, срок задаёт сервер (до 400 дней).
 */
export async function getTrustedDeviceCookie(): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(TRUST_KEY) ?? null;
  return SecureStore.getItemAsync(TRUST_KEY);
}

export async function setTrustedDeviceCookie(cookie: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(TRUST_KEY, cookie);
    return;
  }
  await SecureStore.setItemAsync(TRUST_KEY, cookie);
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
    globalThis.localStorage?.removeItem(USER_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

/** Последний подтверждённый пользователь: без сети приложение не выкидывает на вход. */
export async function getCachedUserJson(): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(USER_KEY) ?? null;
  return SecureStore.getItemAsync(USER_KEY);
}

export async function setCachedUserJson(json: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(USER_KEY, json);
    return;
  }
  await SecureStore.setItemAsync(USER_KEY, json);
}
