import 'server-only';

/**
 * ЛЮДИ И СИСТЕМА — чтение пользователей, прав, согласований, журнала и отчётов.
 *
 * Всё в одном модуле не по лени: это один слой ответственности — «кто в системе и
 * что с ней делали». Разрезать его по файлам значило бы четыре почти одинаковых
 * набора импортов и четыре места, где можно забыть про маску персональных данных.
 *
 * Персональные данные наружу отдаются в том виде, в котором они нужны для работы:
 * имя и адрес почты — да, телефон — да (поддержка звонит), пароль и токены — нет
 * и не запрашиваются. Полный номер счёта в БД отсутствует по построению.
 */

import type { AdminRow } from '@/components/data/data-table';
import { capabilities, defaultRoleCapabilities, type Capability } from '@/config/capabilities';
import { limits } from '@/config/business';
import type { AdminListParams } from '@/config/routes';
import type { Prisma } from '@/generated/prisma/client';
import { userRoles, type UserRole } from '@/domain/enums';
import { db } from '@/lib/db';

const PAGE_SIZE = limits.pagination.defaultPageSize;

export interface PeoplePage {
  rows: readonly AdminRow[];
  total: number;
  page: number;
  pageCount: number;
}

function paging(query: AdminListParams): { skip: number; take: number; page: number } {
  const page = Math.max(query.page ?? 1, 1);
  return { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, page };
}

function pageOf(rows: readonly AdminRow[], total: number, current: number): PeoplePage {
  return { rows, total, page: current, pageCount: Math.max(Math.ceil(total / PAGE_SIZE), 1) };
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/* ─────────────────────────── Пользователи ─────────────────────────── */

export async function listUsers(query: AdminListParams): Promise<PeoplePage> {
  const { skip, take, page } = paging(query);

  const role = userRoles.find((value) => value === query.status);

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
    db.user.count({ where }),
  ]);

  return pageOf(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.isActive,
      createdAt: iso(row.createdAt),
      lastSeenAt: iso(row.lastSeenAt),
    })),
    total,
    page,
  );
}

export async function getUserDetail(id: string) {
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true,
      role: true,
      locale: true,
      timeZone: true,
      isActive: true,
      createdAt: true,
      lastSeenAt: true,
      deletionRequestedAt: true,
      instructor: { select: { id: true, slug: true } },
      _count: { select: { bookings: true, orders: true, reviews: true } },
    },
  });
}

/** Сколько активных администраторов в системе. Нужно, чтобы не остаться без них. */
export async function activeAdminCount(): Promise<number> {
  return db.user.count({ where: { role: 'ADMIN', isActive: true } });
}

/* ─────────────────────── Права: матрица и гранты ─────────────────────── */

export interface CapabilityCell {
  capability: Capability;
  /** Право входит в базовый набор роли. */
  inBaseSet: boolean;
  /** Явный запрет в матрице. */
  denied: boolean;
  /** Живой временный грант перекрывает запрет. */
  granted: boolean;
}

export interface RoleCapabilities {
  role: UserRole;
  cells: readonly CapabilityCell[];
}

/**
 * Матрица прав для управляемых ролей. ADMIN в матрицу не попадает: он не
 * ограничивается никогда, и строка для него была бы приглашением запереть
 * владельца платформы вне админки.
 */
export async function getCapabilityMatrix(): Promise<readonly RoleCapabilities[]> {
  const managed: readonly UserRole[] = ['SUPPORT'];
  const now = new Date();

  const [controls, grants] = await Promise.all([
    db.accessControl.findMany({ select: { role: true, capability: true, enabled: true } }),
    db.accessGrant.findMany({
      where: { expiresAt: { gt: now }, revokedAt: null },
      select: { role: true, capability: true },
    }),
  ]);

  return managed.map((role) => ({
    role,
    cells: capabilities.map((capability) => ({
      capability,
      inBaseSet: (defaultRoleCapabilities[role] ?? []).includes(capability),
      denied: controls.some(
        (control) => control.role === role && control.capability === capability && !control.enabled,
      ),
      granted: grants.some((grant) => grant.role === role && grant.capability === capability),
    })),
  }));
}

/**
 * Активные гранты с именами выдавших.
 *
 * Имя подтягивается вторым запросом: у `AccessGrant` нет связи с `User` в схеме —
 * только `grantedById` строкой. Это не недоработка схемы: журнал прав не должен
 * каскадно удаляться вместе с аккаунтом, иначе история выдачи доступа исчезает
 * вместе с уволенным сотрудником.
 */
export async function listActiveGrants(): Promise<
  readonly {
    id: string;
    role: UserRole;
    capability: string;
    reason: string;
    expiresAt: Date;
    grantedByName: string;
  }[]
> {
  const grants = await db.accessGrant.findMany({
    where: { expiresAt: { gt: new Date() }, revokedAt: null },
    orderBy: { expiresAt: 'asc' },
    select: {
      id: true,
      role: true,
      capability: true,
      reason: true,
      expiresAt: true,
      grantedById: true,
    },
  });

  const names = await namesByIds(grants.map((grant) => grant.grantedById));

  return grants.map((grant) => ({
    id: grant.id,
    role: grant.role,
    capability: grant.capability,
    reason: grant.reason,
    expiresAt: grant.expiresAt,
    grantedByName: names.get(grant.grantedById) ?? grant.grantedById,
  }));
}

/** Имена пользователей по идентификаторам. Один запрос вместо N. */
async function namesByIds(ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });

  return new Map(users.map((user) => [user.id, user.name]));
}

/* ────────────────────────── Согласования ────────────────────────── */

export async function listApprovals(): Promise<
  readonly {
    id: string;
    action: string;
    payload: unknown;
    expiresAt: Date;
    createdAt: Date;
    requestedById: string;
    requestedByName: string;
    /**
     * Срок истёк. Считается на сервере: сравнение с текущим временем в разметке —
     * недетерминированный рендер, и React справедливо на это жалуется.
     */
    expired: boolean;
  }[]
> {
  const requests = await db.approvalRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: PAGE_SIZE,
    select: {
      id: true,
      action: true,
      payload: true,
      expiresAt: true,
      createdAt: true,
      requestedById: true,
    },
  });

  const names = await namesByIds(requests.map((request) => request.requestedById));
  const now = Date.now();

  return requests.map((request) => ({
    id: request.id,
    action: request.action,
    payload: request.payload,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt,
    requestedById: request.requestedById,
    requestedByName: names.get(request.requestedById) ?? request.requestedById,
    expired: request.expiresAt.getTime() <= now,
  }));
}

/* ──────────────────────────── Журнал ──────────────────────────── */

export async function listAuditLog(query: AdminListParams): Promise<PeoplePage> {
  const { skip, take, page } = paging(query);

  const where: Prisma.AuditLogWhereInput = {
    ...(query.status ? { entityType: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { action: { contains: query.q, mode: 'insensitive' } },
            { actorEmail: { contains: query.q, mode: 'insensitive' } },
            { entityId: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        actorEmail: true,
        action: true,
        entityType: true,
        entityId: true,
        ipAddress: true,
        revertedAt: true,
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return pageOf(
    rows.map((row) => ({
      id: row.id,
      createdAt: iso(row.createdAt),
      actorEmail: row.actorEmail,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      ipAddress: row.ipAddress,
      revertedAt: iso(row.revertedAt),
    })),
    total,
    page,
  );
}

/** Типы сущностей, встречающиеся в журнале. Для фильтра, а не для валидации. */
export async function auditEntityTypes(): Promise<readonly string[]> {
  const rows = await db.auditLog.findMany({
    distinct: ['entityType'],
    select: { entityType: true },
    take: 50,
    orderBy: { entityType: 'asc' },
  });
  return rows.map((row) => row.entityType);
}

export async function getAuditEntry(id: string) {
  return db.auditLog.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      actorEmail: true,
      action: true,
      entityType: true,
      entityId: true,
      diff: true,
      reason: true,
      ipAddress: true,
      userAgent: true,
      revertedAt: true,
    },
  });
}

/* ──────────────────────────── Отчёты ──────────────────────────── */

export type ReportRange = '30' | '90' | '365';

export interface ReportTotals {
  revenue: number;
  orders: number;
  bookings: number;
  commission: number;
  topInstructors: readonly { name: string; amount: number }[];
  topClasses: readonly { title: string; count: number }[];
}

const PAID_ORDER_STATUSES = ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] as const;

export function reportSince(range: ReportRange): Date {
  const days = Number.parseInt(range, 10);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getReportTotals(range: ReportRange): Promise<ReportTotals> {
  const since = reportSince(range);

  const [orders, bookings, revenue, commission, instructorRows, classRows] = await Promise.all([
    db.order.count({ where: { placedAt: { gte: since } } }),
    db.booking.count({ where: { createdAt: { gte: since } } }),
    db.order.aggregate({
      _sum: { total: true },
      where: { placedAt: { gte: since }, status: { in: [...PAID_ORDER_STATUSES] } },
    }),
    db.commissionRecord.aggregate({
      _sum: { platformFee: true },
      where: { createdAt: { gte: since } },
    }),
    db.commissionRecord.groupBy({
      by: ['instructorId'],
      where: { createdAt: { gte: since }, instructorId: { not: null } },
      _sum: { grossAmount: true },
      orderBy: { _sum: { grossAmount: 'desc' } },
      take: 5,
    }),
    db.booking.groupBy({
      by: ['sessionId'],
      where: { createdAt: { gte: since }, sessionId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { sessionId: 'desc' } },
      take: 5,
    }),
  ]);

  /* Имена подтягиваются вторым запросом: `groupBy` их не отдаёт. */
  const instructorIds = instructorRows
    .map((row) => row.instructorId)
    .filter((value): value is string => value !== null);

  const instructors = instructorIds.length
    ? await db.instructorProfile.findMany({
        where: { id: { in: instructorIds } },
        select: { id: true, user: { select: { name: true } } },
      })
    : [];

  const sessionIds = classRows
    .map((row) => row.sessionId)
    .filter((value): value is string => value !== null);

  const sessions = sessionIds.length
    ? await db.classSession.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, danceClass: { select: { title: true } } },
      })
    : [];

  return {
    revenue: revenue._sum.total ?? 0,
    orders,
    bookings,
    commission: commission._sum.platformFee ?? 0,
    topInstructors: instructorRows.map((row) => ({
      name: instructors.find((item) => item.id === row.instructorId)?.user.name ?? row.instructorId ?? '',
      amount: row._sum.grossAmount ?? 0,
    })),
    topClasses: classRows.map((row) => ({
      title: sessions.find((item) => item.id === row.sessionId)?.danceClass.title ?? row.sessionId ?? '',
      count: row._count._all,
    })),
  };
}

/** Строки для выгрузки заказов за период. Заголовок собирается в действии. */
export async function ordersForExport(range: ReportRange): Promise<readonly (readonly unknown[])[]> {
  const rows = await db.order.findMany({
    where: { placedAt: { gte: reportSince(range) } },
    orderBy: { placedAt: 'desc' },
    take: limits.query.maxRows,
    select: {
      orderNumber: true,
      status: true,
      contactName: true,
      contactEmail: true,
      subtotal: true,
      discountTotal: true,
      deliveryFee: true,
      vatAmount: true,
      total: true,
      placedAt: true,
      paidAt: true,
    },
  });

  return rows.map((row) => [
    row.orderNumber,
    row.status,
    row.contactName,
    row.contactEmail,
    row.subtotal,
    row.discountTotal,
    row.deliveryFee,
    row.vatAmount,
    row.total,
    row.placedAt.toISOString(),
    row.paidAt?.toISOString() ?? '',
  ]);
}
