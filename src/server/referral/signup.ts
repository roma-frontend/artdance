import 'server-only';

import { cookies } from 'next/headers';

import { growth } from '@/config/growth';
import { parseReferralCode } from '@/domain/referral';
import { bindReferral } from '@/server/referral/service';

/**
 * Привязывает реферала к только что зарегистрированному пользователю по cookie,
 * которую proxy выставил при первом визите с `?ref=`.
 *
 * Не бросает: регистрация не должна падать из-за реферала. Любой сбой (нет cookie,
 * неверный код, отказ привязки) — это пропущенный бонус, но не отказ во входе.
 */
export async function bindReferralFromCookie(refereeId: string): Promise<void> {
  try {
    const raw = (await cookies()).get(growth.referral.cookieName)?.value;
    const code = parseReferralCode(raw);
    if (!code) return;
    await bindReferral({ refereeId, code });
  } catch (error) {
    console.warn('[referral] binding skipped', { refereeId, error });
  }
}
