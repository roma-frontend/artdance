'use client';

/**
 * Формы корпоративных счетов в админке: аккаунт, выставление счёта и отметка оплаты.
 * Отметка «оплачено» пополняет баланс аккаунта, поэтому перед отправкой просим
 * подтверждение, а не полагаемся на один клик.
 */

import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useState, type FormEvent } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import {
  createCorporateAccountAction,
  issueCorporateInvoiceAction,
  markCorporateInvoicePaidAction,
} from '@/server/actions/admin/corporate';

export function CreateCorporateAccountForm() {
  const t = useTranslations('corporate.admin');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const { execute, status, result } = useAction(createCorporateAccountAction, {
    onSuccess: () => {
      setName('');
      setContactEmail('');
      router.refresh();
    },
  });
  const busy = status === 'executing';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    execute({ name, contactEmail });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h2 className="text-card-title">{t('createAccount')}</h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="corporate-account-name">{t('name')}</Label>
        <Input id="corporate-account-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="corporate-account-email">{t('contactEmail')}</Label>
        <Input
          id="corporate-account-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          maxLength={190}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>{t('save')}</Button>
        <ActionError error={result.serverError} t={tRoot} />
      </div>
    </form>
  );
}

export function IssueCorporateInvoiceForm({ accounts }: { accounts: readonly { id: string; name: string }[] }) {
  const t = useTranslations('corporate.admin');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const [corporateAccountId, setCorporateAccountId] = useState(accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');

  const { execute, status, result } = useAction(issueCorporateInvoiceAction, {
    onSuccess: () => {
      setAmount('');
      router.refresh();
    },
  });
  const busy = status === 'executing';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    execute({ corporateAccountId, amount: Number(amount) });
  }

  if (accounts.length === 0) return <p className="text-body-sm text-content-secondary">{t('needAccount')}</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h2 className="text-card-title">{t('issueInvoice')}</h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="corporate-invoice-account">{t('account')}</Label>
        <select
          id="corporate-invoice-account"
          value={corporateAccountId}
          onChange={(e) => setCorporateAccountId(e.target.value)}
          className="h-10 rounded-md border border-border-default bg-surface-card px-3 text-body-sm"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="corporate-invoice-amount">{t('amount')}</Label>
        <Input
          id="corporate-invoice-amount"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>{t('save')}</Button>
        <ActionError error={result.serverError} t={tRoot} />
      </div>
    </form>
  );
}

export function MarkCorporateInvoicePaidButton({ id }: { id: string }) {
  const t = useTranslations('corporate.admin');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const { execute, status, result } = useAction(markCorporateInvoicePaidAction, {
    onSuccess: () => router.refresh(),
  });
  const busy = status === 'executing';

  function onClick() {
    if (!window.confirm(t('confirmPaid'))) return;
    execute({ id });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onClick}>
        {t('markPaid')}
      </Button>
      {result.data ? <p className="text-caption text-content-secondary">{t('markPaidRequested')}</p> : null}
      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}
