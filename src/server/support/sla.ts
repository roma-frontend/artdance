import 'server-only';

import { db } from '@/lib/db';
import { getServerEnv } from '@/config/env';
import { sendEmail } from '@/lib/email/send';
import { support } from '@/config/security';

const SLA_HOURS = 24;
const WARNING_HOURS = 12;

export function slaDueAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS * 60 * 60 * 1000);
}

export function slaStatusFor(ticket: { createdAt: Date; slaDueAt: Date | null; status: string }): 'ok' | 'warn' | 'breach' | 'ok_resolved' {
  if (ticket.status === 'RESOLVED') return 'ok_resolved';
  const due = ticket.slaDueAt ?? new Date(ticket.createdAt.getTime() + SLA_HOURS * 60 * 60 * 1000);
  const now = Date.now();
  const dueMs = due.getTime();
  if (now >= dueMs) return 'breach';
  if (now >= dueMs - WARNING_HOURS * 60 * 60 * 1000) return 'warn';
  return 'ok';
}

export interface SlaReport {
  breached: number;
  warned: number;
  notified: number;
}

/** Warn SLA approaching/breached — sends one email per ticket until resolved. */
export async function runSlaCron(now: Date = new Date()): Promise<SlaReport> {
  const warnCutoff = new Date(now.getTime() - WARNING_HOURS * 60 * 60 * 1000);
  // breached: slaDueAt <= now and not yet notified as breached
  // warn: slaDueAt in (now, now+12h] and not yet notified at all
  const tickets = await db.supportTicket.findMany({
    where: {
      status: { in: ['OPEN', 'PENDING'] },
      OR: [
        { slaDueAt: { lte: now }, slaNotifiedAt: null },
        { slaDueAt: { lte: now, gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, slaNotifiedAt: { lt: new Date(now.getTime() - 12 * 60 * 60 * 1000) } },
      ],
    } as never,
    select: { id: true, name: true, email: true, topic: true, message: true, createdAt: true, slaDueAt: true, slaNotifiedAt: true },
    take: 50,
  });

  // More inclusive: also grab warn-phase tickets not yet notified
  const warnTickets = await db.supportTicket.findMany({
    where: {
      status: { in: ['OPEN', 'PENDING'] },
      slaDueAt: { gt: now, lte: new Date(now.getTime() + WARNING_HOURS * 60 * 60 * 1000) },
      slaNotifiedAt: null,
    } as never,
    select: { id: true, topic: true, createdAt: true, slaDueAt: true },
    take: 20,
  });

  let breached = 0;
  let warned = 0;
  let notified = 0;

  const env = getServerEnv();
  const recipients = support.operatorEmails;

  // breached notifications
  for (const t of tickets) {
    const due = (t as { slaDueAt: Date | null }).slaDueAt ?? new Date((t as { createdAt: Date }).createdAt.getTime() + SLA_HOURS * 3600_000);
    const isBreach = now.getTime() >= due.getTime();
    if (isBreach) breached += 1;

    // throttle: don't re-notify within 12h
    const last = (t as { slaNotifiedAt: Date | null }).slaNotifiedAt;
    if (last && now.getTime() - new Date(last).getTime() < 12 * 60 * 60 * 1000) continue;

    const subject = isBreach ? `[ArtDance] SLA breached — ${t.topic}` : `[ArtDance] SLA warning — ${t.topic}`;
    const heading = isBreach ? 'SLA breached' : 'SLA warning';
    const paragraphs = [
      `${t.name} <${t.email}> — ${t.topic}`,
      `"${String((t as { message?: string }).message ?? '').slice(0, 400)}"`,
      `Created: ${new Date((t as { createdAt: Date }).createdAt).toISOString()}`,
      `SLA due: ${due.toISOString()} — ${isBreach ? 'breach' : '12h warning'}`,
      `Ticket: ${t.id}`,
    ];

    let delivered = false;
    for (const to of recipients) {
      const res = await sendEmail({ to, locale: 'ru', subject, heading, paragraphs }).catch(() => ({ delivered: false }));
      delivered = delivered || Boolean((res as { delivered?: boolean }).delivered);
    }
    // also log if no email provider
    if (!env.RESEND_API_KEY) {
      console.info('[sla] provider not configured — ticket', t.id, isBreach ? 'BREACH' : 'WARN');
    }
    if (delivered || !env.RESEND_API_KEY) {
      await db.supportTicket.update({ where: { id: t.id }, data: { slaNotifiedAt: now } as never }).catch(() => {});
      notified += 1;
    }
  }

  // warn-phase (without breach yet) — count only
  for (const w of warnTickets) {
    // avoid double-count if already in tickets
    if (tickets.some((x) => x.id === w.id)) continue;
    warned += 1;
    // also send warn email (once)
    const subject = `[ArtDance] SLA warning — ${w.topic}`;
    for (const to of recipients) {
      await sendEmail({
        to,
        locale: 'ru',
        subject,
        heading: 'SLA warning',
        paragraphs: [
          `Ticket: ${w.id} — ${w.topic}`,
          `Created: ${new Date((w as { createdAt: Date }).createdAt).toISOString()}`,
          `SLA due: ${new Date((w as { slaDueAt: Date | null }).slaDueAt ?? new Date((w as { createdAt: Date }).createdAt.getTime() + SLA_HOURS * 3600_000).toISOString()).toISOString()}`,
        ],
      }).catch(() => {});
    }
    await db.supportTicket.update({ where: { id: w.id }, data: { slaNotifiedAt: now } as never }).catch(() => {});
    notified += 1;
  }

  // also count existing warn vs breach for report
  void warnCutoff;
  return { breached, warned, notified };
}
