/**
 * ENTITLEMENT GUARDS — единственная легальная точка проверки на страницах и в API.
 *
 * Зачем отдельный модуль, если `isEntitlementEnabled()` уже существует: до него
 * каждый вызов выглядел как `await isEntitlementEnabled('shop').catch(() => true)`
 * —36 таких мест разъездались по проекту, и любое из них превращало сбой базы
 * в «модуль включён». Гвард читает снимок через `getEffectiveEntitlementsSafe()`,
 * где отказ откатывается на env-флаги, и решает это один раз.
 *
 * Отказ тоже здесь, а не в вызывающем коде: `notFound()` на публичной странице
 * и `FEATURE_DISABLED` в API — один смысл («раздела нет»), два способа его
 * выразить. Писать `if (!(await …))` заново нельзя — это и есть то место, где
 * однажды забывают `.catch`.
 *
 * `snapshot` принимается параметром, когда снимок уже загружен: страница с тремя
 * гейтами не должна делать три обращения к БД ради одного объекта.
 */

import 'server-only';

import { notFound } from 'next/navigation';

import type { FeatureKey } from '@/config/features';
import { domainErrors } from '@/domain/errors';

import { getEffectiveEntitlementsSafe } from './service';

export type EntitlementSnapshot = Record<FeatureKey, boolean>;

/** На публичной странице: выключенный модуль = 404, как у `isGatedOff` в sitemap. */
export async function assertEntitlementOrNotFound(
  feature: FeatureKey,
  snapshot?: EntitlementSnapshot,
): Promise<void> {
  const effective = snapshot ?? (await getEffectiveEntitlementsSafe());
  if (!effective[feature]) notFound();
}

/** Для API и server actions: выключенный модуль = `FEATURE_DISABLED`, а не 404. */
export async function assertEntitlementOrThrow(
  feature: FeatureKey,
  snapshot?: EntitlementSnapshot,
): Promise<void> {
  const effective = snapshot ?? (await getEffectiveEntitlementsSafe());
  if (!effective[feature]) throw domainErrors.featureDisabled();
}

/** Читает один снимок на запрос и отдаёт его всем последующим проверкам. */
export function loadEntitlementSnapshot(): Promise<EntitlementSnapshot> {
  return getEffectiveEntitlementsSafe();
}
