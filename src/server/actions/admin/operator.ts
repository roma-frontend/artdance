'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { operatorJobs, operatorExportLimit } from '@/config/operator';
import { isSupportOperator } from '@/config/security';
import { locales, type Locale } from '@/i18n/config';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { exportModel, validateTranslation } from '@/server/admin/operator';
import { purgeExpiredTrash } from '@/server/admin/trash';
import { purgeExpiredHolds } from '@/server/hold/service';
import { runBookingCron, runDailyDigest } from '@/server/cron/tasks';
import { sendEmail } from '@/lib/email/send';
import { authedAction } from '@/server/safe-action';
import { invalidateEntitlementsCache } from '@/server/entitlements/service';
import { requireOperator } from '@/lib/auth/guards';
import { completeTerminal, runTerminalCommand, tokenizeTerminalCommand } from '@/server/terminal/commands';

const id = z.string().trim().min(1).max(128);

function auditCommandSummary(raw: string): string {
  const tokens = tokenizeTerminalCommand(raw);
  const redacted = new Set(['--data', '--set', '--where']);
  return tokens.map((token, index) => redacted.has(tokens[index - 1] ?? '') ? '[redacted]' : token).join(' ');
}

export const saveTranslationOverride = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.operator.translation' })
  .inputSchema(z.object({ key: id, locale: z.enum(locales), value: z.string().trim().min(1).max(10_000) }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    await validateTranslation(parsedInput.key, parsedInput.locale as Locale, parsedInput.value);
    const row = await db.operatorSetting.upsert({
      where: { key: `i18n.${parsedInput.locale}.${parsedInput.key}` },
      create: { key: `i18n.${parsedInput.locale}.${parsedInput.key}`, value: parsedInput.value, updatedBy: caller.id },
      update: { value: parsedInput.value, updatedBy: caller.id },
    });
    await recordAudit({ actor: caller, action: 'admin.operator.translation', entityType: 'OperatorSetting', entityId: row.key, after: { locale: parsedInput.locale, key: parsedInput.key }, ipAddress: ctx.identifier });
    revalidatePath('/', 'layout');
    return { saved: true };
  });

export const resetTranslationOverride = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.operator.translationReset' })
  .inputSchema(z.object({ key: id, locale: z.enum(locales) }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    const key = `i18n.${parsedInput.locale}.${parsedInput.key}`;
    await db.operatorSetting.delete({ where: { key } }).catch(() => null);
    await recordAudit({ actor: caller, action: 'admin.operator.translationReset', entityType: 'OperatorSetting', entityId: key, ipAddress: ctx.identifier });
    revalidatePath('/', 'layout');
    return { reset: true };
  });

export const revokeSession = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.operator.sessionRevoke' })
  .inputSchema(z.object({ sessionId: id }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    const session = await db.session.findUnique({ where: { id: parsedInput.sessionId }, select: { id: true, userId: true } });
    if (!session) return { revoked: false };
    await db.session.delete({ where: { id: session.id } });
    await recordAudit({ actor: caller, action: 'admin.operator.sessionRevoke', entityType: 'Session', entityId: session.id, after: { userId: session.userId }, ipAddress: ctx.identifier });
    return { revoked: true };
  });

export const revokeAllUserSessions = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'session.revokedAll' })
  .inputSchema(z.object({ userId: id }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    if (parsedInput.userId === caller.id) throw new Error('Cannot revoke your own operator sessions');
    const target = await db.user.findUnique({ where: { id: parsedInput.userId }, select: { id: true, email: true } });
    if (!target) throw new Error('User not found');
    const result = await db.session.deleteMany({ where: { userId: target.id } });
    await recordAudit({ actor: caller, action: 'session.revokedAll', entityType: 'User', entityId: target.id, after: { revoked: result.count, email: target.email }, ipAddress: ctx.identifier });
    return { revoked: result.count };
  });

export const runOperatorJob = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.operator.job' })
  .inputSchema(z.object({ job: z.enum(operatorJobs) }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    const runKey = `${parsedInput.job}:${new Date().toISOString().slice(0, 13)}`;
    const run = await db.jobRun.create({ data: { jobName: parsedInput.job, runKey, startedAt: new Date() }, select: { id: true } }).catch(() => null);
    try {
      const result = parsedInput.job === 'booking'
        ? await runBookingCron(new Date())
        : parsedInput.job === 'holds'
          ? await purgeExpiredHolds(new Date())
          : parsedInput.job === 'trash'
            ? await purgeExpiredTrash(new Date())
            : await runDailyDigest(new Date());
      if (run) await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), succeeded: true } });
      await recordAudit({ actor: caller, action: 'admin.operator.job', entityType: 'JobRun', entityId: run?.id ?? parsedInput.job, after: { job: parsedInput.job, result }, ipAddress: ctx.identifier });
      return { ok: true, result };
    } catch (error) {
      if (run) await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), succeeded: false, error: error instanceof Error ? error.message.slice(0, 500) : String(error) } });
      throw error;
    }
  });

export const startImpersonation = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.operator.impersonationStart' })
  .inputSchema(z.object({ userId: id }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    if (parsedInput.userId === caller.id) throw new Error('Cannot impersonate yourself');
    const target = await db.user.findUnique({ where: { id: parsedInput.userId }, select: { id: true, email: true, name: true, role: true, isActive: true } });
    if (!target || !target.isActive || target.role === 'ADMIN' || target.role === 'SUPPORT' || isSupportOperator(target)) throw new Error('This account cannot be impersonated');
    const session = await db.session.findFirst({ where: { userId: caller.id, expiresAt: { gt: new Date() } }, select: { id: true } });
    if (!session) throw new Error('Operator session not found');
    const expiresAt = Date.now() + 30 * 60_000;
    await db.operatorSetting.upsert({ where: { key: `impersonation.${session.id}` }, create: { key: `impersonation.${session.id}`, value: { userId: target.id, expiresAt }, updatedBy: caller.id }, update: { value: { userId: target.id, expiresAt }, updatedBy: caller.id } });
    await recordAudit({ actor: caller, action: 'admin.operator.impersonationStart', entityType: 'User', entityId: target.id, after: { expiresAt }, ipAddress: ctx.identifier });
    return { name: target.name, expiresAt };
  });

export const stopImpersonation = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.operator.impersonationStop' })
  .inputSchema(z.object({}).optional())
  .action(async ({ ctx }) => {
    const caller = await requireOperator();
    const sessions = await db.session.findMany({ where: { userId: caller.id, expiresAt: { gt: new Date() } }, select: { id: true } });
    for (const session of sessions) await db.operatorSetting.delete({ where: { key: `impersonation.${session.id}` } }).catch(() => null);
    await recordAudit({ actor: caller, action: 'admin.operator.impersonationStop', entityType: 'Session', entityId: caller.id, ipAddress: ctx.identifier });
    return { stopped: true };
  });

export const exportOperatorModel = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.operator.export' })
  .inputSchema(z.object({ model: id }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    const rows = await exportModel(parsedInput.model);
    if (rows.length > operatorExportLimit) throw new Error('Export too large');
    await recordAudit({ actor: caller, action: 'admin.operator.export', entityType: parsedInput.model, entityId: parsedInput.model, after: { rows: rows.length }, ipAddress: ctx.identifier });
    return rows;
  });

export const runOperatorCommand = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.operator.command' })
  .inputSchema(z.object({ command: z.string().trim().min(1).max(4000) }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    const raw = parsedInput.command.trim();
    const head = raw.split(/\s+/)[0]?.toLowerCase() ?? 'unknown';
    const { lines, ok } = await runTerminalCommand(raw);
    const summary = auditCommandSummary(raw);
    await recordAudit({ actor: caller, action: 'admin.operator.command', entityType: 'OperatorCommand', entityId: head, after: { command: summary, ok }, ipAddress: ctx.identifier });
    return { lines, ok };
  });

export const completeOperatorCommand = authedAction
  .metadata({ rateLimit: 'adminAutocomplete' })
  .inputSchema(z.object({ command: z.string().max(4000) }))
  .action(async ({ parsedInput }) => ({ items: await completeTerminal(parsedInput.command) }));

export const replyToSupportTicket = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.support.reply' })
  .inputSchema(z.object({ ticketId: id, body: z.string().trim().min(1).max(10_000), internal: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    const ticket = await db.supportTicket.findUnique({ where: { id: parsedInput.ticketId }, select: { id: true, email: true, name: true, topic: true, locale: true, status: true } });
    if (!ticket) throw new Error('Ticket not found');
    const delivery = parsedInput.internal ? { delivered: false } : await sendEmail({
      to: ticket.email,
      replyTo: ticket.email,
      locale: ticket.locale,
      subject: `[ArtDance support] ${ticket.topic}`,
      heading: 'ArtDance support',
      paragraphs: [parsedInput.body],
    });
    const reply = await db.supportReply.create({ data: { ticketId: ticket.id, actorId: caller.id, body: parsedInput.body, internal: parsedInput.internal, delivered: delivery.delivered }, select: { id: true } });
    await db.supportTicket.update({ where: { id: ticket.id }, data: { status: parsedInput.internal ? ticket.status : 'PENDING' } });
    await recordAudit({ actor: caller, action: 'admin.support.reply', entityType: 'SupportTicket', entityId: ticket.id, after: { replyId: reply.id, internal: parsedInput.internal, delivered: delivery.delivered }, ipAddress: ctx.identifier });
    return { delivered: delivery.delivered };
  });

export const setFeatureFlag = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.operator.featureFlag' })
  .inputSchema(z.object({ key: z.string().trim().regex(/^[a-z][a-zA-Z0-9]*$/).max(64), enabled: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireOperator();
    const row = await db.featureFlagOverride.upsert({ where: { key: parsedInput.key }, create: { key: parsedInput.key, enabled: parsedInput.enabled, updatedBy: caller.id }, update: { enabled: parsedInput.enabled, updatedBy: caller.id } });
    await recordAudit({ actor: caller, action: 'admin.operator.featureFlag', entityType: 'FeatureFlagOverride', entityId: row.id, after: { key: parsedInput.key, enabled: parsedInput.enabled }, ipAddress: ctx.identifier });
    invalidateEntitlementsCache();
    revalidatePath('/', 'layout');
    return { enabled: row.enabled };
  });
