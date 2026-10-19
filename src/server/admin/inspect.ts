import 'server-only';

import { db } from '@/lib/db';
import { requireOperator } from '@/lib/auth/guards';
import { getBookingDetail } from './operations';
import { getOrderDetail } from './operations';
import { getUserDetail } from './people';

export const inspectModels = ['User', 'Order', 'Booking', 'SupportTicket'] as const;
export type InspectModel = (typeof inspectModels)[number];

export interface InspectRecord {
  model: InspectModel;
  id: string;
  record: Record<string, unknown>;
}

export interface OperatorEntityPreview {
  model: InspectModel;
  id: string;
  title: string;
  subtitle: string;
  status: string | null;
  fields: Array<{ label: string; value: string }>;
  href?: string;
}

const ticketSelect = {
  id: true,
  name: true,
  email: true,
  topic: true,
  message: true,
  locale: true,
  status: true,
  priority: true,
  assigneeId: true,
  slaDueAt: true,
  slaNotifiedAt: true,
  firstResponseAt: true,
  resolvedAt: true,
  resolvedById: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true, role: true, isActive: true } },
  replies: {
    orderBy: { createdAt: 'desc' as const },
    take: 25,
    select: { id: true, actorId: true, body: true, internal: true, delivered: true, createdAt: true },
  },
  attachments: {
    orderBy: { createdAt: 'asc' as const },
    take: 25,
    select: { id: true, fileName: true, mimeType: true, bytes: true, replyId: true, uploadedById: true, createdAt: true },
  },
  _count: { select: { replies: true, attachments: true } },
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
}

export async function inspectOperatorRecord(model: string, key: string): Promise<InspectRecord | null> {
  await requireOperator();
  const rawModel = model.trim().toLowerCase();
  const singular = rawModel.endsWith('ies') ? `${rawModel.slice(0, -3)}y` : rawModel.endsWith('s') ? rawModel.slice(0, -1) : rawModel;
  const normalized = inspectModels.find((item) => item.toLowerCase() === rawModel || item.toLowerCase() === singular);
  if (!normalized || !key.trim()) return null;
  const lookup = key.trim();

  if (normalized === 'User') {
    const match = await db.user.findFirst({ where: { OR: [{ id: lookup }, { email: lookup }] }, select: { id: true } });
    if (!match) return null;
    const record = await getUserDetail(match.id);
    return record ? { model: normalized, id: match.id, record: asRecord(record) } : null;
  }

  if (normalized === 'Order') {
    const match = await db.order.findFirst({ where: { OR: [{ id: lookup }, { orderNumber: lookup }] }, select: { id: true } });
    if (!match) return null;
    const record = await getOrderDetail(match.id);
    return record ? { model: normalized, id: match.id, record: asRecord(record) } : null;
  }

  if (normalized === 'Booking') {
    const match = await db.booking.findFirst({ where: { OR: [{ id: lookup }, { reference: lookup }] }, select: { id: true } });
    if (!match) return null;
    const record = await getBookingDetail(match.id);
    return record ? { model: normalized, id: match.id, record: asRecord(record) } : null;
  }

  const record = await db.supportTicket.findUnique({ where: { id: lookup }, select: ticketSelect });
  return record ? { model: normalized, id: lookup, record: asRecord(record) } : null;
}

export function inspectValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_, item) => {
    if (typeof item === 'bigint') return item.toString();
    if (item instanceof Date) return item.toISOString();
    return item;
  }));
}

function shorten(value: string, limit = 420): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function displayValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return 'none';
  if (key.toLowerCase().includes('phone') && typeof value === 'string') return `***${value.slice(-4)}`;
  if (typeof value === 'string') return shorten(value);
  if (typeof value === 'object') return JSON.stringify(inspectValue(value));
  return String(value);
}

function appendObject(lines: string[], value: Record<string, unknown>, indent = ''): void {
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || key === 'id') continue;
    if (Array.isArray(item)) {
      lines.push(`${indent}${key}: ${item.length}`);
      item.slice(0, 25).forEach((child, index) => {
        if (child && typeof child === 'object') {
          lines.push(`${indent}- ${index + 1}`);
          appendObject(lines, child as Record<string, unknown>, `${indent}  `);
        } else {
          lines.push(`${indent}- ${displayValue(key, child)}`);
        }
      });
      continue;
    }
    if (item && typeof item === 'object') {
      lines.push(`${indent}${key}:`);
      appendObject(lines, item as Record<string, unknown>, `${indent}  `);
      continue;
    }
    lines.push(`${indent}${key}: ${displayValue(key, item)}`);
  }
}

export function formatInspect(record: InspectRecord): string[] {
  const normalized = inspectValue(record.record) as Record<string, unknown>;
  const lines = [`${record.model} ${record.id}`];
  const root: Record<string, unknown> = {};
  const nested: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (['_count', 'items', 'payments', 'refunds', 'replies', 'attachments', 'user', 'customer', 'instructor', 'venue', 'room', 'assignee', 'session', 'event', 'invoice'].includes(key)) nested[key] = value;
    else root[key] = value;
  }
  appendObject(lines, root);
  for (const [key, value] of Object.entries(nested)) {
    lines.push('');
    if (key === '_count' && value && typeof value === 'object') {
      lines.push('counts:');
      appendObject(lines, value as Record<string, unknown>, '  ');
    } else if (Array.isArray(value)) {
      lines.push(`${key}: ${value.length}`);
      value.slice(0, 25).forEach((item, index) => {
        lines.push(`- ${index + 1}`);
        if (item && typeof item === 'object') appendObject(lines, item as Record<string, unknown>, '  ');
      });
    } else if (value && typeof value === 'object') {
      lines.push(`${key}:`);
      appendObject(lines, value as Record<string, unknown>, '  ');
    }
  }
  return lines;
}

function previewString(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(inspectValue(value));
  return String(value);
}

export function formatEntityPreview(record: InspectRecord): OperatorEntityPreview {
  const data = inspectValue(record.record) as Record<string, unknown>;
  const field = (label: string, key: string) => ({ label, value: previewString(data[key]) });
  if (record.model === 'User') {
    return {
      model: record.model,
      id: record.id,
      title: previewString(data.name),
      subtitle: previewString(data.email),
      status: data.isActive === false ? 'inactive' : 'active',
      fields: [field('Role', 'role'), field('Locale', 'locale'), field('Last seen', 'lastSeenAt'), field('Created', 'createdAt')],
    };
  }
  if (record.model === 'Order') {
    return {
      model: record.model,
      id: record.id,
      title: previewString(data.orderNumber),
      subtitle: previewString(data.contactName),
      status: previewString(data.status),
      fields: [field('Email', 'contactEmail'), field('Total', 'total'), field('Placed', 'placedAt'), field('Paid', 'paidAt')],
    };
  }
  if (record.model === 'Booking') {
    return {
      model: record.model,
      id: record.id,
      title: previewString(data.reference),
      subtitle: previewString(data.subject),
      status: previewString(data.status),
      fields: [field('Starts', 'startsAt'), field('Participants', 'participants'), field('Total', 'totalPrice'), field('Created', 'createdAt')],
    };
  }
  return {
    model: record.model,
    id: record.id,
    title: previewString(data.topic),
    subtitle: previewString(data.email),
    status: previewString(data.status),
    fields: [field('Priority', 'priority'), field('Created', 'createdAt'), field('SLA due', 'slaDueAt'), field('Replies', '_count')],
  };
}
