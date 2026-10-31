'use server';

/**
 * КОРПОРАТИВНЫЕ СЧЕТА (B-06) — действия админки: аккаунт, выставленный счёт и
 * отметка оплаты переводом. Баланс меняется только в `markInvoicePaid`, и только
 * при переходе счёта из PENDING в PAID. Каждое действие пишет в журнал аудита.
 */

import { z } from 'zod';

import { requireCapability } from '@/lib/auth/guards';
import { recordAudit } from '@/lib/audit';
import { createCorporateAccount, issueInvoice, markInvoicePaid } from '@/server/corporate/service';
import { authedAction } from '@/server/safe-action';

export const createCorporateAccountAction = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.corporate.account.create' })
  .inputSchema(
    z.object({
      name: z.string().trim().min(2).max(120),
      contactEmail: z.string().trim().email().max(190),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ id: string }> => {
    const caller = await requireCapability('corporate.manage');
    const account = await createCorporateAccount(parsedInput);

    await recordAudit({
      actor: caller,
      action: 'admin.corporate.account.create',
      entityType: 'CorporateAccount',
      entityId: account.id,
      after: { name: account.name },
      ipAddress: ctx.identifier,
    });

    return { id: account.id };
  });

export const issueCorporateInvoiceAction = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.corporate.invoice.issue' })
  .inputSchema(
    z.object({
      corporateAccountId: z.string().trim().min(1).max(64),
      amount: z.number().int().positive().max(100_000_000),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ id: string; number: string }> => {
    const caller = await requireCapability('corporate.manage');
    const invoice = await issueInvoice({
      corporateAccountId: parsedInput.corporateAccountId,
      amount: parsedInput.amount,
    });

    await recordAudit({
      actor: caller,
      action: 'admin.corporate.invoice.issue',
      entityType: 'Invoice',
      entityId: invoice.id,
      after: { number: invoice.number, amount: invoice.amount, corporateAccountId: parsedInput.corporateAccountId },
      ipAddress: ctx.identifier,
    });

    return { id: invoice.id, number: invoice.number };
  });

export const markCorporateInvoicePaidAction = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.corporate.invoice.paid' })
  .inputSchema(z.object({ id: z.string().trim().min(1).max(64) }))
  .action(async ({ parsedInput, ctx }): Promise<{ status: 'PAID' }> => {
    const caller = await requireCapability('corporate.manage');
    const invoice = await markInvoicePaid(parsedInput.id);

    await recordAudit({
      actor: caller,
      action: 'admin.corporate.invoice.paid',
      entityType: 'Invoice',
      entityId: invoice.id,
      after: { status: 'PAID', amount: invoice.amount, corporateAccountId: invoice.corporateAccountId },
      ipAddress: ctx.identifier,
    });

    return { status: 'PAID' };
  });
