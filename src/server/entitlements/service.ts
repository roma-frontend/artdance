/**
 * ENTITLEMENTS SERVICE — server-only, рантайм-оверрайд над env-флагами.
 *
 * Источники (приоритет сверху вниз):
 *   1) FeatureFlagOverride[key]  — fine-toggle (null = не трогает пресет)
 *   2) OperatorSetting entitlement.preset  — MVP/FULL/PREMIUM
 *   3) fallback из `src/config/features.ts` (env) — на сборке/CI когда БД недоступна
 *
 * Причины архитектуры:
 *  • Не создаём новую таблицу: `FeatureFlagOverride` уже есть и индексирована;
 *    `OperatorSetting` — key/value runtime-хранилище. Новая таблица = миграция и
 *    риск `migrate diff --exit-code`.
 *  • Не ломаем синхронный `features/isEnabled` — он остаётся fallback'ом, а
 *    рантайм решает «как видит клиент» и используется в server-guards страниц.
 */

import 'server-only';

import { features, type FeatureKey } from '@/config/features';
import { ENTITLEMENT_SETTING_KEY, isEntitlementPreset, presetDefaults, type EntitlementPreset } from './catalog';

function parsePresetValue(value: unknown): EntitlementPreset | null {
  if (typeof value === 'string' && isEntitlementPreset(value)) return value;
  if (value !== null && typeof value === 'object' && 'preset' in value) {
    const p = (value as { preset?: unknown }).preset;
    if (typeof p === 'string' && isEntitlementPreset(p)) return p;
  }
  return null;
}

export interface EntitlementsState {
  preset: EntitlementPreset | null;
  overrides: Map<FeatureKey, boolean>;
  updatedAt: string | null;
}

/** Дефолт до первого применения пресета — MVP (договор 5 000 000 ֏). Применяется только при явном `resetEntitlements()`. */
export const ENTITLEMENTS_DEFAULT_PRESET: EntitlementPreset = 'mvp';

let inMemoryCache: { at: number; state: EntitlementsState } | null = null;
const TTL_MS = 30_000;

export async function getEntitlementsState(options?: { force?: boolean }): Promise<EntitlementsState> {
  const now = Date.now();
  if (!options?.force && inMemoryCache && now - inMemoryCache.at < TTL_MS) return inMemoryCache.state;

  // Сборка/CI без БД — отдаём env-fallback (тесты sitemap уже на нём завязаны).
  // В тестах база намеренно не поднимается: не создаём Prisma-запрос только для
  // того, чтобы поймать ожидаемый отказ и получить тот же env-fallback.
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  if (isTestEnv) {
    return { preset: null, overrides: new Map<FeatureKey, boolean>(), updatedAt: null };
  }

  try {
    const { db } = await import('@/lib/db');
    const [presetRow, flagRows] = await Promise.all([
      db.operatorSetting.findUnique({ where: { key: ENTITLEMENT_SETTING_KEY }, select: { value: true, updatedAt: true } }),
      db.featureFlagOverride.findMany({ select: { key: true, enabled: true } }),
    ]);

    const preset = presetRow ? parsePresetValue(presetRow.value) : null;
    const overrides = new Map<FeatureKey, boolean>();
    for (const row of flagRows) {
      const key = row.key as FeatureKey;
      if (key in presetDefaults.mvp) overrides.set(key, row.enabled);
    }

    const state: EntitlementsState = {
      preset,
      overrides,
      updatedAt: presetRow?.updatedAt ? new Date(presetRow.updatedAt as unknown as string).toISOString() : null,
    };
    inMemoryCache = { at: now, state };
    return state;
  } catch (error) {
    if (!isTestEnv) console.warn('[entitlements] DB unavailable, using env fallback', error);
    const overrides = new Map<FeatureKey, boolean>();
    const state: EntitlementsState = { preset: null, overrides, updatedAt: null };
    return state;
  }
}

export function resolveEffectiveEnabled(preset: EntitlementPreset | null, overrides: Map<FeatureKey, boolean>, key: FeatureKey): boolean {
  if (overrides.has(key)) return overrides.get(key)!;
  if (preset) return presetDefaults[preset][key] ?? features[key] ?? false;
  // Пресет ещё не выбран (свежая БД) — ведём себя как env, чтобы e2e не получил 404.
  return features[key] ?? false;
}

/** Совместимость: синхронный читатель как раньше — не трогает БД. */
export function getEffectiveSnapshotSync(): Record<FeatureKey, boolean> {
  // На клиенте/в тестах без state — env. На сервере pages вызовут async-версию.
  return { ...features } as Record<FeatureKey, boolean>;
}

export async function getEffectiveEntitlements(): Promise<Record<FeatureKey, boolean>> {
  const state = await getEntitlementsState();
  const out = {} as Record<FeatureKey, boolean>;
  for (const key of Object.keys(presetDefaults.mvp) as FeatureKey[]) {
    out[key] = resolveEffectiveEnabled(state.preset, state.overrides, key);
  }
  return out;
}

/**
 * Снимок, который не бросает НИКОГДА — точка входа для страниц и API.
 *
 * Отличие от `getEffectiveEntitlements()`: любой неожиданный отказ (битая строка
 * в `OperatorSetting`, сломанный импорт, выключенная таблица) откатывается на
 * env-флаги, а не на `true`. Разница видна только при сбое: раньше страница
 * решала «сбой базы = модуль включён», то есть при недоступной БД на проде
 * открывались все разделы, включая те, что заказчик не оплатил. Env-флаги —
 * явно заданный на сборке контракт, и откат к ним не меняет решения в пользу
 * включённого.
 *
 * Возвращает полный набор ключей: вызывающий не должен проверять
 * «ключ есть в объекте», ему нужен ответ «включён/выключен».
 */
export async function getEffectiveEntitlementsSafe(): Promise<Record<FeatureKey, boolean>> {
  try {
    return await getEffectiveEntitlements();
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[entitlements] state unavailable, falling back to env flags', error);
    }
    const out = {} as Record<FeatureKey, boolean>;
    for (const key of Object.keys(presetDefaults.mvp) as FeatureKey[]) {
      out[key] = features[key] ?? false;
    }
    return out;
  }
}

export function effectiveFromState(state: EntitlementsState): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>;
  for (const key of Object.keys(presetDefaults.mvp) as FeatureKey[]) {
    out[key] = resolveEffectiveEnabled(state.preset, state.overrides, key);
  }
  return out;
}

export async function isEntitlementEnabled(key: FeatureKey): Promise<boolean> {
  const state = await getEntitlementsState();
  return resolveEffectiveEnabled(state.preset, state.overrides, key);
}

/** Инвалидация кеша после записи preset/override. */
export function invalidateEntitlementsCache(): void {
  inMemoryCache = null;
}
