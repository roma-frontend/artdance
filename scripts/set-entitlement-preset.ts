/**
 * Установка пресета entitlements в БД.
 *
 *   npx tsx --env-file=.env.local scripts/set-entitlement-preset.ts [mvp|full|premium]
 *
 * Нужен, когда пресет надо выставить до первого входа владельца в админку —
 * свежая база его не содержит, и страницы живут на env-флагах. Дальше пресет
 * переключается в админке.
 */

import { db } from '../src/lib/db';
import { ENTITLEMENT_SETTING_KEY, entitlementPresets, isEntitlementPreset } from '../src/server/entitlements/catalog';

async function main() {
  const arg = process.argv[2] ?? 'mvp';
  if (!isEntitlementPreset(arg)) {
    throw new Error(`Неизвестный пресет «${arg}». Допустимые: ${entitlementPresets.join(', ')}.`);
  }

  console.log(`[entitlements] Setting preset to: ${arg}`);

  await db.operatorSetting.upsert({
    where: { key: ENTITLEMENT_SETTING_KEY },
    create: { key: ENTITLEMENT_SETTING_KEY, value: arg, updatedBy: 'cli-setup' },
    update: { value: arg, updatedBy: 'cli-setup' },
  });

  console.log('[entitlements] Preset set successfully. Restart app to invalidate cache.');
}

main()
  .catch((error) => {
    console.error('[entitlements] Failed to set preset:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
