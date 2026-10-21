/**
 * КАТАЛОГ ТАРИФОВ не расходится с картой фич.
 *
 * Три источника перечисляют одни и те же ключи: `features` (env-карта),
 * `presetDefaults` (что входит в каждый пресет) и `entitlementFeatureCatalog`
 * (что показывает панель). Рассинхрон между ними не ломает сборку: пропущенный
 * в пресете ключ означает, что модуль в панели не переключается, а пропущенный
 * в каталоге — что переключается негде.
 *
 * Монотонность — то, что обещает и имя, и договор: FULL должен содержать MVP,
 * а PREMIUM — FULL. Обратное включение (модуль есть в MVP, но нет в PREMIUM)
 * означало бы, что заказчик, заплативший больше, потерял функцию.
 */

import { describe, expect, it } from 'vitest';

import { features, type FeatureKey } from '@/config/features';

import { entitlementFeatureCatalog, entitlementPresets, presetDefaults } from './catalog';

const mvpKeys = Object.keys(presetDefaults.mvp).sort();
const featureKeys = Object.keys(features).sort();
const catalogKeys = entitlementFeatureCatalog.map((f) => f.key).sort();

describe('ключи пресетов', () => {
  it('все три пресета перечисляют один и тот же набор ключей', () => {
    for (const preset of entitlementPresets) {
      expect(Object.keys(presetDefaults[preset]).sort(), `пресет ${preset}`).toEqual(mvpKeys);
    }
  });

  it('совпадают с картой фич: тумблер есть для каждого ключа env', () => {
    expect(featureKeys).toEqual(mvpKeys);
  });

  it('совпадают с панелью: каждая строка каталога — ключ пресета', () => {
    expect(catalogKeys).toEqual(mvpKeys);
  });

  it('каталог не содержит дублей', () => {
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);
  });
});

describe('монотонность тарифов', () => {
  it('FULL содержит всё, что в MVP', () => {
    for (const key of mvpKeys as FeatureKey[]) {
      if (!presetDefaults.mvp[key]) continue;
      expect(presetDefaults.full[key], `FULL потерял «${key}» из MVP`).toBe(true);
    }
  });

  it('PREMIUM содержит всё, что в FULL', () => {
    for (const key of mvpKeys as FeatureKey[]) {
      if (!presetDefaults.full[key]) continue;
      expect(presetDefaults.premium[key], `PREMIUM потерял «${key}» из FULL`).toBe(true);
    }
  });

  it('PREMIUM включает каждый ключ каталога: это и есть обещание тарифа', () => {
    for (const meta of entitlementFeatureCatalog) {
      expect(presetDefaults.premium[meta.key], `PREMIUM не даёт «${meta.key}»`).toBe(true);
    }
  });
});
