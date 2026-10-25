import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { adoptSessionToken, signInWithAppleIdToken } from './auth';
import { API_URL } from './config';

export type SocialProvider = 'google' | 'apple';
export type SocialProviders = Record<SocialProvider, boolean>;

/** Ссылка, на которую сервер возвращает браузер входа; совпадает со `scheme` в app.json. */
const CALLBACK = 'artdance://auth-callback';

/** Какие социальные входы настроены на сервере. Ошибка сети означает «ни одного». */
export async function loadSocialProviders(): Promise<SocialProviders> {
  try {
    const response = await fetch(`${API_URL}/api/mobile/auth/providers`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return { google: false, apple: false };
    const body = (await response.json()) as Partial<SocialProviders>;
    return { google: body.google === true, apple: body.apple === true };
  } catch {
    return { google: false, apple: false };
  }
}

function base64url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += alphabet[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += alphabet[n & 63];
  }
  return out;
}

export class SocialSignInError extends Error {}

/**
 * Вход через провайдера в системном браузере (PKCE): сервер возвращает одноразовый код,
 * который меняется на токен только вместе с verifier, оставшимся в приложении.
 * Возвращает false, если человек закрыл браузер.
 */
export async function signInWithBrowser(provider: SocialProvider): Promise<boolean> {
  const verifier = base64url(Crypto.getRandomBytes(32));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const start = `${API_URL}/api/mobile/auth/start?provider=${provider}&challenge=${encodeURIComponent(challenge)}`;

  const result = await WebBrowser.openAuthSessionAsync(start, CALLBACK);
  if (result.type !== 'success') return false;
  const code = new URL(result.url).searchParams.get('code');
  if (!code) return false;

  const response = await fetch(`${API_URL}/api/mobile/auth/exchange`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, verifier }),
  });
  const body = (await response.json().catch(() => null)) as { token?: string } | null;
  if (!response.ok || !body?.token) throw new SocialSignInError(`HTTP ${response.status}`);
  await adoptSessionToken(body.token);
  return true;
}

/** Нативный Sign in with Apple есть только на iOS 13+; на Android Apple идёт через браузер. */
export async function nativeAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/** Возвращает false, если человек отменил системный диалог Apple. */
export async function signInWithAppleNative(): Promise<boolean> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new SocialSignInError('NO_IDENTITY_TOKEN');
    await signInWithAppleIdToken({
      token: credential.identityToken,
      firstName: credential.fullName?.givenName,
      lastName: credential.fullName?.familyName,
      email: credential.email,
    });
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw error;
  }
}
