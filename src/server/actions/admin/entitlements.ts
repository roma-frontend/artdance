'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { isEntitlementOwner } from '@/config/security';
import { recordAudit } from '@/lib/audit';
import { requireOperator } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { authedAction } from '@/server/safe-action';
import { ENTITLEMENT_SETTING_KEY, entitlementFeatureCatalog, entitlementPresets, isEntitlementPreset, presetDefaults } from '@/server/entitlements/catalog';
import { invalidateEntitlementsCache } from '@/server/entitlements/service';
import { features, type FeatureKey } from '@/config/features';

const presetSchema = z.enum(entitlementPresets as unknown as [string, ...string[]]);
const featureKeySchema = z.enum(Object.keys(presetDefaults.mvp) as [string, ...string[]]);

async function assertOwner(): Promise<Awaited<ReturnType<typeof requireOperator>>> {
  const caller = await requireOperator();
  if (!isEntitlementOwner(caller)) throw new Error('Entitlements are restricted to the platform owner');
  return caller;
}

export const setEntitlementPreset = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.entitlement.preset' })
  .inputSchema(z.object({ preset: presetSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await assertOwner();
    const preset = parsedInput.preset as (typeof entitlementPresets)[number];
    if (!isEntitlementPreset(preset)) throw new Error('Unknown preset');

    const row = await db.operatorSetting.upsert({
      where: { key: ENTITLEMENT_SETTING_KEY },
      create: { key: ENTITLEMENT_SETTING_KEY, value: preset, updatedBy: caller.id },
      update: { value: preset, updatedBy: caller.id },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.entitlement.preset',
      entityType: 'Entitlement',
      entityId: ENTITLEMENT_SETTING_KEY,
      after: { preset },
      ipAddress: ctx.identifier,
    });

    invalidateEntitlementsCache();
    revalidatePath('/', 'layout');
    return { preset, key: row.key };
  });

export const setEntitlementOverride = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.entitlement.override' })
  .inputSchema(
    z.object({
      key: featureKeySchema,
      enabled: z.boolean().nullable(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const caller = await assertOwner();
    const key = parsedInput.key as FeatureKey;

    // null = снять оверрайд (вернуться к пресету)
    if (parsedInput.enabled === null) {
      await db.featureFlagOverride.delete({ where: { key } }).catch(() => null);
      await recordAudit({
        actor: caller,
        action: 'admin.entitlement.overrideReset',
        entityType: 'FeatureFlagOverride',
        entityId: key,
        after: { key, enabled: null },
        ipAddress: ctx.identifier,
      });
      invalidateEntitlementsCache();
      revalidatePath('/', 'layout');
      return { key, enabled: null };
    }

    const row = await db.featureFlagOverride.upsert({
      where: { key },
      create: { key, enabled: parsedInput.enabled, updatedBy: caller.id },
      update: { enabled: parsedInput.enabled, updatedBy: caller.id },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.entitlement.override',
      entityType: 'FeatureFlagOverride',
      entityId: row.id,
      after: { key, enabled: parsedInput.enabled },
      ipAddress: ctx.identifier,
    });
    invalidateEntitlementsCache();
    revalidatePath('/', 'layout');
    return { key, enabled: row.enabled };
  });

export const resetEntitlements = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.entitlement.reset' })
  .inputSchema(z.object({}).optional())
  .action(async ({ ctx }) => {
    const caller = await assertOwner();
    // Сброс: удалить все fine-оверрайды наших ключей + вернуть preset в mvp
    const catalogKeys = entitlementFeatureCatalog.map((f) => f.key);
    await db.featureFlagOverride.deleteMany({ where: { key: { in: catalogKeys } } }).catch(() => null);
    await db.operatorSetting.upsert({
      where: { key: ENTITLEMENT_SETTING_KEY },
      create: { key: ENTITLEMENT_SETTING_KEY, value: 'mvp', updatedBy: caller.id },
      update: { value: 'mvp', updatedBy: caller.id },
    });
    // env defaults остаются как есть — они теперь только fallback
    void features;
    await recordAudit({
      actor: caller,
      action: 'admin.entitlement.reset',
      entityType: 'Entitlement',
      entityId: ENTITLEMENT_SETTING_KEY,
      after: { preset: 'mvp', resets: catalogKeys },
      ipAddress: ctx.identifier,
    });
    invalidateEntitlementsCache();
    revalidatePath('/', 'layout');
    return { preset: 'mvp' as const };
  });
