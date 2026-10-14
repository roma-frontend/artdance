/**
 * ENTITLEMENT GUARDS — серверные гарды для страниц/API за флагом поставки.
 */

import 'server-only';

import { notFound } from 'next/navigation';

import type { FeatureKey } from '@/config/features';
import { domainErrors } from '@/domain/errors';

import { isEntitlementEnabled } from './service';

/**
 * На публичной странице: выключенная фича = 404 как у sitemap.test isGatedOff.
 * Используется вместо `if (!features.shop) notFound()` с fallback'ом на 404.
 */
export async function assertEntitlementOrNotFound(feature: FeatureKey): Promise<void> {
  const enabled = await isEntitlementEnabled(feature).catch(() => null);
  // На сборке без БД — не блокируем (fallback на env делает вид «всё включено» в рантайме, а CI чинит env).
  if (enabled === null) return;
  if (!enabled) notFound();
}

/** Для API/Server Actions за фичей. */
export async function assertEntitlementOrThrow(feature: FeatureKey): Promise<void> {
  const enabled = await isEntitlementEnabled(feature).catch(() => null);
  if (enabled === null) return;
  if (!enabled) throw domainErrors.featureDisabled();
}
