import { Linking } from 'react-native';

/** Страница провайдера открывается только по https; http допустим в разработке для mock-провайдера. */
export function isSafePaymentUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || (__DEV__ && protocol === 'http:');
  } catch {
    return false;
  }
}

/** Открывает оплату провайдера; false, если ссылка небезопасна или не открылась. */
export async function openPaymentUrl(url: string | null | undefined): Promise<boolean> {
  if (!url || !isSafePaymentUrl(url)) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
