import 'server-only';

import { isEntitlementOwner, isSupportOperator } from '@/config/security';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import {
  ENTITLEMENT_SETTING_KEY,
  entitlementFeatureCatalog,
  isEntitlementPreset,
  presetDefaults,
  type EntitlementPreset,
} from '@/server/entitlements/catalog';
import { getGodPulse } from './god';

export type OperatorGate = { ok: true; canManageEntitlements: boolean } | { ok: false; status: 401 | 403 };

/** Проверка доступа для мобильных эндпоинтов: сначала вход, затем allowlist оператора. */
export async function operatorGate(): Promise<OperatorGate> {
  const caller = await getCaller({ realActor: true });
  if (!caller) return { ok: false, status: 401 };
  if (!isSupportOperator(caller)) return { ok: false, status: 403 };
  return { ok: true, canManageEntitlements: isEntitlementOwner(caller) };
}

export type MobileSupportSnapshot = Awaited<ReturnType<typeof getMobileSupportSnapshot>>;

export async function getMobileSupportSnapshot(canManageEntitlements: boolean) {
  const catalogKeys = entitlementFeatureCatalog.map((f) => f.key);

  const [pulse, presetRow, overrideRows, ticketRows, payoutRows] = await Promise.all([
    getGodPulse(),
    db.operatorSetting.findUnique({ where: { key: ENTITLEMENT_SETTING_KEY }, select: { value: true } }),
    db.featureFlagOverride.findMany({ where: { key: { in: catalogKeys } }, select: { key: true, enabled: true } }),
    db.supportTicket.findMany({
      where: { status: { in: ['OPEN', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, name: true, topic: true, message: true, status: true, createdAt: true },
    }),
    db.payout.findMany({
      where: { status: { in: ['SCHEDULED', 'PROCESSING', 'ON_HOLD', 'FAILED'] } },
      orderBy: { periodEnd: 'asc' },
      take: 30,
      select: { id: true, reference: true, amount: true, currencyCode: true, status: true, periodEnd: true, failureReason: true },
    }),
  ]);

  const presetValue = typeof presetRow?.value === 'string' ? presetRow.value : 'mvp';
  const preset: EntitlementPreset = isEntitlementPreset(presetValue) ? presetValue : 'mvp';
  const overrides: Record<string, boolean> = {};
  for (const row of overrideRows) overrides[row.key] = row.enabled;

  const features = entitlementFeatureCatalog.map((f) => {
    const override = overrides[f.key];
    return {
      key: f.key,
      group: f.group,
      tier: f.tier,
      enabled: override ?? presetDefaults[preset][f.key],
      overridden: override !== undefined,
    };
  });

  const paymentProvider = process.env.PAYMENT_PROVIDER ?? 'mock';
  const integrations = [
    { key: 'payments', provider: paymentProvider, connected: paymentProvider !== 'mock' },
    { key: 'email', provider: 'resend', connected: Boolean(process.env.RESEND_API_KEY) },
    { key: 'storage', provider: 'r2', connected: Boolean(process.env.R2_ACCESS_KEY_ID) },
    {
      key: 'sms',
      provider: process.env.SMS_PROVIDER ?? 'mock',
      connected: (process.env.SMS_PROVIDER ?? 'mock') !== 'mock' && Boolean(process.env.SMS_API_KEY),
    },
  ];

  return {
    canManageEntitlements,
    pulse,
    entitlements: { preset, features },
    tickets: ticketRows.map((t) => ({
      id: t.id,
      name: t.name,
      topic: t.topic,
      message: t.message.slice(0, 300),
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    })),
    payouts: payoutRows.map((p) => ({
      id: p.id,
      reference: p.reference,
      amount: p.amount,
      currencyCode: p.currencyCode,
      status: p.status,
      periodEnd: p.periodEnd.toISOString(),
      failureReason: p.failureReason,
    })),
    integrations,
  };
}
