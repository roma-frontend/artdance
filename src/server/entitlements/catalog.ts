/**
 * ENTITLEMENTS CATALOG — единый реестр пакетов и фич.
 *
 * Пресет = коммерческий пакет из `docs/01-commercial-proposal.md`:
 *   MVP     — 5 000 000 ֏, база для показа клиенту
 *   FULL    — 9 200 000 ֏ (рекомендуемый пакет)
 *   PREMIUM — 13 000 000 ֏ (видео, комиссии, выплаты, CRM)
 *
 * Fine-toggles — по ключам из `src/config/features.ts` (FeatureKey).
 * Причина: навигация, sitemap и поиск уже фильтруются ровно этими ключами.
 * Отдельный enum «entitlement-key» означал бы две системы флагов и их рассинхрон.
 *
 * **SMS в состав пакетов не входит:** шлюза нет ни в коде, ни у заказчика
 * (`SMS_SENDER_ID` — 2–3 недели на регистрацию), а канал, который не
 * отправляется, хуже его отсутствия. FULL/PREMIUM обещают Email и Push (Push уходит через web-push при заданных VAPID-ключах, см. `docs/07-feature-backlog.md`, C-07);
 * SMS возвращается вместе с провайдером — отдельной строкой в
 * `docs/06-implementation-plan.md` («вне договора»).
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
  { key: 'shop', labelKey: 'shop', tier: 'mvp', group: 'store', docsRef: 'docs/01-commercial-proposal.md §2 — FULL (PLATFORM): магазин, корзина, склад' },
  { key: 'events', labelKey: 'events', tier: 'full', group: 'content', docsRef: 'docs/06-implementation-plan.md — движок бронирования' },
  { key: 'courses', labelKey: 'courses', tier: 'premium', group: 'content', docsRef: 'docs/01-commercial-proposal.md §2 — PREMIUM (MARKETPLACE): онлайн-курсы' },
  { key: 'videoCourses', labelKey: 'videoCourses', tier: 'premium', group: 'content', docsRef: 'docs/01-commercial-proposal.md §2 — PREMIUM (MARKETPLACE): онлайн-курсы с видео' },
  { key: 'subscriptions', labelKey: 'subscriptions', tier: 'premium', group: 'platform', docsRef: 'docs/01-commercial-proposal.md §2 — PREMIUM (MARKETPLACE): подписки' },
  { key: 'wallet', labelKey: 'wallet', tier: 'premium', group: 'platform', docsRef: 'docs/07-feature-backlog.md B-04 — кошелёк и единая книга' },
  { key: 'referrals', labelKey: 'referrals', tier: 'premium', group: 'platform', docsRef: 'docs/07-feature-backlog.md B-05 — рефералы' },
  { key: 'packages', labelKey: 'packages', tier: 'premium', group: 'platform', docsRef: 'docs/07-feature-backlog.md B-01 — пакеты занятий' },
  { key: 'recurring', labelKey: 'recurring', tier: 'full', group: 'platform', docsRef: 'docs/07-feature-backlog.md B-02 — регулярные брони' },
  { key: 'push', labelKey: 'push', tier: 'full', group: 'platform', docsRef: 'docs/07-feature-backlog.md C-07 — web push' },
  { key: 'boost', labelKey: 'boost', tier: 'premium', group: 'platform', docsRef: 'docs/07-feature-backlog.md B-07 — промо-размещение' },
  { key: 'cms', labelKey: 'cms', tier: 'mvp', group: 'platform', docsRef: 'docs/06-implementation-plan.md — базовая админка' },
  { key: 'calendarSync', labelKey: 'calendarSync', tier: 'premium', group: 'platform', docsRef: 'docs/07-feature-backlog.md — синхронизация с календарём (phase3)' },
  { key: 'forYou', labelKey: 'forYou', tier: 'full', group: 'content', docsRef: 'docs/07-feature-backlog.md — персональная подборка по анкете танцора' },
  { key: 'liveActivities', labelKey: 'liveActivities', tier: 'premium', group: 'platform', docsRef: 'docs/07-feature-backlog.md — Live Activity (iOS) для занятий' },
  { key: 'homeWidgets', labelKey: 'homeWidgets', tier: 'premium', group: 'platform', docsRef: 'docs/07-feature-backlog.md — виджет ближайшего занятия (iOS)' },
  { key: 'dancePartner', labelKey: 'dancePartner', tier: 'premium', group: 'content', docsRef: 'docs/07-feature-backlog.md — подбор партнёра по совместимости анкет' },
] as const;

/**
 * Дефолты пресета. `true` = фича включена в пакете (до overrides).
 * Состав сверяется с `docs/01-commercial-proposal.md` §2; расхождения с договором в `docs/06-implementation-plan.md` ещё не закрыты.
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
    calendarSync: false,
    forYou: false,
    liveActivities: false,
    homeWidgets: false,
    dancePartner: false,
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
    calendarSync: false,
    forYou: true,
    liveActivities: false,
    homeWidgets: false,
    dancePartner: false,
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
    calendarSync: true,
    forYou: true,
    liveActivities: true,
    homeWidgets: true,
    dancePartner: true,
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
      return '9 200 000 ֏';
    case 'premium':
      return '13 000 000 ֏';
  }
}
