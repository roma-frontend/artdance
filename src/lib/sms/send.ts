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

import { checkSmsBudget } from '@/lib/sms/budget';

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

  const budget = await checkSmsBudget(new Date()).catch((error: unknown) => {
    console.error('[sms] бюджет не проверен, SMS не отправлено', error);
    return null;
  });
  if (budget === null) return { delivered: false, reason: 'budget-unavailable' };
  if (!budget.ok) {
    console.warn(`[sms] лимит SMS (${budget.period}) исчерпан, SMS не отправлено`);
    return { delivered: false, reason: 'budget-exceeded' };
  }

  // Провайдер появится здесь. После принятия SMS записать SmsDispatch: по нему считается бюджет.
  // До тех пор ветка недостижима: см. isSmsConfigured.
  void input;
  return { delivered: false, reason: 'not-implemented' };
}
