/**
 * ENTITLEMENTS CATALOG — единый реестр пакетов и фич.
 *
 * Связан с договорами Proposal_EN (MVP/FULL/PREMIUM) и ArtDance_Plan_RU
 * (фикс 5 000 000 ֏, MVP+3 языка+QA). Пресет = коммерческий пакет:
 *   MVP     — 5 000 000 ֏, база для показа клиенту
 *   FULL    — 5–6 млн AMD (Proposal_EN Recommended)
 *   PREMIUM — 7–8+ млн (видео, комиссии, выплаты, CRM)
 *
 * Fine-toggles — по ключам из `src/config/features.ts` (FeatureKey).
 * Причина: навигация, sitemap и поиск уже фильтруются ровно этими ключами.
 * Отдельный enum «entitlement-key» означал бы две системы флагов и их рассинхрон.
 */

import type { FeatureKey } from '@/config/features';

export const entitlementPresets = ['mvp', 'full', 'premium'] as const;
export type EntitlementPreset = (typeof entitlementPresets)[number];

export const ENTITLEMENT_SETTING_KEY = 'entitlement.preset' as const;

export interface FeatureMeta {
  key: FeatureKey;
  labelKey: string; // i18n: admin.entitlements.feature.*
  tier: EntitlementPreset; // минимальный пресет где фича «положена» по договору
  group: 'store' | 'content' | 'platform';
  docsRef: string;
}

export const entitlementFeatureCatalog: readonly FeatureMeta[] = [
  { key: 'shop', labelKey: 'shop', tier: 'mvp', group: 'store', docsRef: 'ArtDance_Plan_RU: Магазин' },
  { key: 'events', labelKey: 'events', tier: 'full', group: 'content', docsRef: 'Proposal_EN FULL: events' },
  { key: 'courses', labelKey: 'courses', tier: 'premium', group: 'content', docsRef: 'Proposal_EN PREMIUM: video + courses' },
  { key: 'videoCourses', labelKey: 'videoCourses', tier: 'premium', group: 'content', docsRef: 'Proposal_EN Phase 2' },
  { key: 'subscriptions', labelKey: 'subscriptions', tier: 'premium', group: 'platform', docsRef: 'Proposal_EN PREMIUM: subscriptions' },
  { key: 'wallet', labelKey: 'wallet', tier: 'premium', group: 'platform', docsRef: 'PREMIUM: commissions' },
  { key: 'referrals', labelKey: 'referrals', tier: 'premium', group: 'platform', docsRef: 'PREMIUM: loyalty' },
  { key: 'packages', labelKey: 'packages', tier: 'premium', group: 'platform', docsRef: 'PREMIUM: classPass' },
  { key: 'recurring', labelKey: 'recurring', tier: 'full', group: 'platform', docsRef: 'FULL: booking engine' },
  { key: 'push', labelKey: 'push', tier: 'full', group: 'platform', docsRef: 'FULL: Email+SMS' },
  { key: 'boost', labelKey: 'boost', tier: 'premium', group: 'platform', docsRef: 'PREMIUM: CRM/boost' },
  { key: 'cms', labelKey: 'cms', tier: 'mvp', group: 'platform', docsRef: 'MVP: базовая админка' },
] as const;

/**
 * Дефолты пресета. `true` = фича включена в пакете (до overrides).
 * Совпадают с таблицей «Состав MVP и границы» + Proposal_EN Packages.
 */
export const presetDefaults: Record<EntitlementPreset, Record<FeatureKey, boolean>> = {
  mvp: {
    shop: true,
    courses: false,
    events: false,
    subscriptions: false,
    videoCourses: false,
    wallet: false,
    referrals: false,
    packages: false,
    recurring: false,
    push: false,
    boost: false,
    cms: true,
  },
  full: {
    shop: true,
    courses: false,
    events: true,
    subscriptions: false,
    videoCourses: false,
    wallet: false,
    referrals: false,
    packages: false,
    recurring: true,
    push: true,
    boost: false,
    cms: true,
  },
  premium: {
    shop: true,
    courses: true,
    events: true,
    subscriptions: true,
    videoCourses: true,
    wallet: true,
    referrals: true,
    packages: true,
    recurring: true,
    push: true,
    boost: true,
    cms: true,
  },
} as const;

export function isEntitlementPreset(value: string): value is EntitlementPreset {
  return (entitlementPresets as readonly string[]).includes(value);
}

export function presetLabelKey(preset: EntitlementPreset): string {
  return `admin.entitlements.preset.${preset}`;
}

export function presetPriceHint(preset: EntitlementPreset): string {
  switch (preset) {
    case 'mvp':
      return '5 000 000 ֏';
    case 'full':
      return '5–6 000 000 ֏';
    case 'premium':
      return '7–8+ 000 000 ֏';
  }
}
