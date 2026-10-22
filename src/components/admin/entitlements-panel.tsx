'use client';

import { useAction } from 'next-safe-action/hooks';
import { useRouter } from '@/i18n/routing';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { resetEntitlements, setEntitlementOverride, setEntitlementPreset } from '@/server/actions/admin/entitlements';
import { routes } from '@/config';
import { presetDefaults, type EntitlementPreset, type FeatureMeta } from '@/server/entitlements/catalog';
import type { FeatureKey } from '@/config/features';

interface PanelProps {
  preset: EntitlementPreset | null;
  rows: Array<{ meta: FeatureMeta; presetValue: boolean; effective: boolean; overridden: boolean }>;
  timeline: Array<{ id: string; action: string; actorEmail: string; createdAt: Date; diff: unknown }>;
}

const PRESETS: EntitlementPreset[] = ['mvp', 'full', 'premium'];

function presetLabel(preset: EntitlementPreset, tp: ReturnType<typeof useTranslations>) {
  return String(tp(`preset.${preset}` as never));
}

export function EntitlementsPanel({ preset, rows, timeline }: PanelProps) {
  const t = useTranslations('admin.support');
  const tp = useTranslations('entitlements' as never);
  const router = useRouter();
  const [pendingPreset, setPendingPreset] = useState<EntitlementPreset>(preset ?? 'mvp');
  const [confirmPreset, setConfirmPreset] = useState<EntitlementPreset | null>(null);

  const applyPreset = useAction(setEntitlementPreset, { onSuccess: () => router.refresh() });
  const toggleOverride = useAction(setEntitlementOverride, { onSuccess: () => router.refresh() });
  const reset = useAction(resetEntitlements, { onSuccess: () => router.refresh() });

  const effectiveMap = new Map(rows.map((r) => [r.meta.key, r.effective] as const));
  const upcomingMap = confirmPreset ? new Map(Object.entries(presetDefaults[confirmPreset]) as Array<[FeatureKey, boolean]>) : null;
  const diffRows = confirmPreset && upcomingMap
    ? rows
        .map((r) => {
          const before = effectiveMap.get(r.meta.key as FeatureKey) ?? false;
          const after = upcomingMap.get(r.meta.key as FeatureKey) ?? false;
          return before === after ? null : { key: r.meta.key, before, after };
        })
        .filter(Boolean) as Array<{ key: string; before: boolean; after: boolean }>
    : [];
  const subscriptionsWillBeEnabled = confirmPreset ? presetDefaults[confirmPreset].subscriptions : false;

  return (
    <div className="flex flex-col gap-6">
      {/* Текущий план */}
      <Card className="border-accent/20 bg-accent-soft/20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-content-primary">{t('entitlementsCurrent')}</CardTitle>
              <CardDescription className="mt-1 max-w-prose">{t('entitlementsCurrentHint')}</CardDescription>
            </div>
            {preset ? <Badge variant="accent" size="md">{tp(`preset.${preset}` as never)}</Badge> : <Badge variant="neutral" size="md">env</Badge>}
          </div>
          {!preset && <CardDescription className="mt-2 text-caption">{t('entitlementsPresetUnset')}</CardDescription>}
        </CardHeader>
      </Card>

      {/* Пресеты — 1 клик + дифф */}
      <div className="grid gap-4 md:grid-cols-3">
        {PRESETS.map((p) => {
          const active = p === preset;
          return (
            <Card key={p} className={active ? 'border-accent bg-accent-soft/10 ring-1 ring-accent' : 'border-border-default'}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-content-primary">
                  {presetLabel(p, tp)}
                  {active ? <Badge variant="success" size="sm">{t('activeBadge')}</Badge> : null}
                </CardTitle>
                <CardDescription className="text-caption">{tp(`presetHint.${p}` as never)}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-3 text-caption font-semibold text-content-secondary">{tp(`presetPrice.${p}` as never)}</p>
                <Button
                  size="sm"
                  variant={active ? 'outline' : 'accent'}
                  pending={applyPreset.status === 'executing' && pendingPreset === p}
                  onClick={() => {
                    if (active) return;
                    setPendingPreset(p);
                    setConfirmPreset(p);
                  }}
                  disabled={active && applyPreset.status !== 'executing'}
                  className="w-full"
                >
                  {active ? t('presetActive') : t('applyPreset')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!confirmPreset} onOpenChange={(open) => !open && setConfirmPreset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmPreset ? presetLabel(confirmPreset, tp) : ''}</DialogTitle>
            <DialogDescription>{t('entitlementsDiffHint')}</DialogDescription>
          </DialogHeader>
          {subscriptionsWillBeEnabled && (
            <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2">
              <p className="text-body-sm font-semibold text-content-primary">
                {t('entitlementsSubscriptionsWarning')}
              </p>
            </div>
          )}
          {diffRows.length === 0 ? (
            <p className="text-body-sm text-content-secondary">{t('entitlementsDiffEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {diffRows.map((d) => (
                <li key={d.key} className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2">
                  <span className="font-mono text-caption text-content-primary">{d.key}</span>
                  <span className="flex items-center gap-2 text-caption">
                    <Badge variant={d.before ? 'success' : 'neutral'} size="sm">{d.before ? t('flagEnabled') : t('flagDisabled')}</Badge>
                    <span className="text-content-tertiary">→</span>
                    <Badge variant={d.after ? 'success' : 'neutral'} size="sm">{d.after ? t('flagEnabled') : t('flagDisabled')}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPreset(null)}>{t('entitlementsDiffCancel')}</Button>
            <Button
              variant="accent"
              pending={applyPreset.status === 'executing'}
              onClick={() => {
                if (!confirmPreset) return;
                const p = confirmPreset;
                setConfirmPreset(null);
                applyPreset.execute({ preset: p });
              }}
            >
              {t('entitlementsDiffConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={routes.home()} target="_blank" rel="noreferrer">{t('entitlementsOpenAsClient')}</a>
        </Button>
        <span className="self-center text-caption text-content-tertiary">{t('entitlementsOpenAsClientHint')}</span>
      </div>

      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-content-primary">{t('entitlementsTimelineTitle')}</CardTitle>
            <CardDescription>{t('entitlementsTimelineHint')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {timeline.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-card px-3 py-2">
                <span className="font-mono text-caption text-content-primary">{String(row.action).replace('admin.entitlement.', '')}</span>
                <span className="text-caption text-content-tertiary">
                  {row.actorEmail} · {new Date(row.createdAt).toLocaleString()} {row.diff ? `· ${JSON.stringify(row.diff).slice(0, 80)}` : ''}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Advanced — точечные оверрайды */}
      <Card>
        <CardHeader>
          <CardTitle className="text-content-primary">{t('entitlementsAdvanced')}</CardTitle>
          <CardDescription>{t('entitlementsAdvancedHint')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {rows.map(({ meta, presetValue, effective, overridden }) => (
            <div
              key={meta.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-body-sm font-semibold text-content-primary">{meta.key}</p>
                <p className="mt-0.5 max-w-prose text-caption text-content-secondary">{tp(`feature.${meta.key}` as never)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-caption">
                  <Badge variant={overridden ? 'warning' : 'neutral'} size="sm">
                    {overridden ? t('flagOverride') : t('fromPreset')}
                  </Badge>
                  <span className="text-content-tertiary">
                    {t('presetValue')}: {presetValue ? t('flagEnabled') : t('flagDisabled')} · {t('effective')}:{' '}
                    {effective ? t('flagEnabled') : t('flagDisabled')}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={effective}
                  onCheckedChange={(next) => {
                    // Вкл/выкл = оверрайд; «сброс» — отдельной кнопкой
                    toggleOverride.execute({ key: meta.key as FeatureKey, enabled: next });
                  }}
                  aria-label={meta.key}
                />
                {overridden ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    pending={toggleOverride.status === 'executing'}
                    onClick={() => toggleOverride.execute({ key: meta.key as FeatureKey, enabled: null })}
                  >
                    {t('resetOverride')}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
            <Button
              size="sm"
              variant="outline"
              pending={reset.status === 'executing'}
              onClick={() => {
                if (!confirm(t('entitlementsResetConfirm'))) return;
                reset.execute({});
              }}
            >
              {t('entitlementsReset')}
            </Button>
            <span className="self-center text-caption text-content-tertiary">{t('entitlementsResetHint')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
