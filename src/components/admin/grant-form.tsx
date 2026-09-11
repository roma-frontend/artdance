'use client';

/**
 * GRANT FORM — временный доступ на срок.
 *
 * Существует ради того, что реально происходит в поддержке: «выдай мне на два
 * часа доступ к возвратам, разберусь с этим клиентом». Альтернатива — сменить
 * роль и забыть откатить, и через полгода половина команды администраторы.
 *
 * Причина обязательна: грант без объяснения невозможно проверить постфактум.
 * Права на деньги и роли в список не попадают вообще (`nonGrantableCapabilities`)
 * — их выдают решением о роли, а не на два часа.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { grantLimits } from '@/config/capabilities';
import { userRoleLabelKey, type UserRole } from '@/domain/enums';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { createAccessGrant, revokeAccessGrant } from '@/server/actions/admin/people';

interface GrantFormProps {
  /** Роли, которым можно выдать грант (администратор в список не входит). */
  roles: readonly UserRole[];
  /** Права, доступные для временной выдачи. */
  capabilities: readonly string[];
}

export function GrantForm({ roles, capabilities }: GrantFormProps) {
  const t = useTranslations('admin.roles');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const [role, setRole] = useState<UserRole>(roles[0] ?? 'SUPPORT');
  const [capability, setCapability] = useState(capabilities[0] ?? '');
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState<number>(grantLimits.defaultMinutes);

  const { execute, status, result } = useAction(createAccessGrant, {
    onSuccess: () => {
      setReason('');
      router.refresh();
    },
  });

  const busy = status === 'executing';
  const valid = capability.length > 0 && reason.trim().length >= 3;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) execute({ role, capability, reason, minutes });
      }}
    >
      <p className="text-body-sm text-content-secondary">{t('nonGrantableNotice')}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="grant-role" className="text-label uppercase text-content-secondary">
            {tRoot('admin.fields.role')}
          </label>
          <select
            id="grant-role"
            value={role}
            disabled={busy}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className="form-input"
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {tRoot(userRoleLabelKey(value))}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="grant-capability" className="text-label uppercase text-content-secondary">
            {tRoot('admin.fields.capability')}
          </label>
          <select
            id="grant-capability"
            value={capability}
            disabled={busy}
            onChange={(event) => setCapability(event.target.value)}
            className="form-input"
          >
            {capabilities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="grant-minutes" className="text-label uppercase text-content-secondary">
            {tRoot('admin.fields.minutes')}
          </label>
          <input
            id="grant-minutes"
            type="number"
            min={grantLimits.minMinutes}
            max={grantLimits.maxMinutes}
            step={5}
            value={minutes}
            disabled={busy}
            onChange={(event) => setMinutes(Number.parseInt(event.target.value, 10) || grantLimits.minMinutes)}
            className="form-input"
          />
          <p className="text-caption text-content-tertiary">
            {t('grantMinutesHint', { min: grantLimits.minMinutes, max: grantLimits.maxMinutes })}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="grant-reason" className="text-label uppercase text-content-secondary">
            {tRoot('admin.fields.reason')}
          </label>
          <input
            id="grant-reason"
            type="text"
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
            className="form-input"
          />
        </div>
      </div>

      <ActionError error={result.serverError} t={tRoot} />

      <Button type="submit" variant="accent" size="sm" disabled={busy || !valid}>
        {t('grantCta')}
      </Button>
    </form>
  );
}

/** Отзыв гранта. Отдельная кнопка на строку: операция точечная и мгновенная. */
export function RevokeGrantButton({ id }: { id: string }) {
  const t = useTranslations('admin.roles');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const { execute, status, result } = useAction(revokeAccessGrant, {
    onSuccess: () => router.refresh(),
  });

  return (
    <span className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={status === 'executing'}
        onClick={() => execute({ id })}
      >
        {t('grantRevokeCta')}
      </Button>
      <ActionError error={result.serverError} t={tRoot} />
    </span>
  );
}
