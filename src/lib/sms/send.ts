/**
 * SMS — одна дверь наружу, как `lib/email/send.ts`.
 *
 * Провайдера пока нет: регистрации по телефону нет, и SMS-ветка двухфакторной
 * защиты не срабатывает ни для одного аккаунта. Заглушка честно отвечает
 * «не настроено», а вызывающий код отправляет код на почту.
 *
 * Подключение провайдера: реализовать `sendSms` и `isSmsConfigured`. Вызывающий
 * код (`lib/auth/two-factor-otp.ts`) при этом не меняется.
 */

import 'server-only';

export interface SmsResult {
  delivered: boolean;
  reason?: string;
}

/** Настроен ли провайдер. Пока нет — SMS-канал выключен и код идёт на почту. */
export function isSmsConfigured(): boolean {
  return false;
}

export async function sendSms(input: { to: string; text: string }): Promise<SmsResult> {
  if (!isSmsConfigured()) {
    /*
     * Номер и текст не логируются: номер — персональные данные, текст — код входа.
     */
    console.info('[sms] провайдер не настроен, SMS не отправлено');
    return { delivered: false, reason: 'provider-not-configured' };
  }

  // Провайдер появится здесь. До тех пор ветка недостижима: см. isSmsConfigured.
  void input;
  return { delivered: false, reason: 'not-implemented' };
}
