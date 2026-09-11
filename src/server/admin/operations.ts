import 'server-only';

/**
 * ОПЕРАЦИИ АДМИНКИ — чтение заказов, броней, выплат и очереди модерации.
 *
 * Почему это не ресурсы реестра. У заказа нет формы «создать заказ»: заказ создаёт
 * покупатель, а администратор меняет его состояние и оформляет возврат. То же с
 * бронью, выплатой и отзывом. Свести их к «список + форма полей» значит выдать
 * администратору право переписать сумму заказа — ровно то, чего в платёжной
 * системе быть не должно.
 *
 * Поэтому здесь только чтение, а изменение состояния — отдельные действия с
 * проверкой правил (`src/server/actions/admin/operations.ts`).
 *
 * Ничего не кешируется: заказ, который администратор видит на экране, обязан быть
 * текущим — по нему принимается решение о деньгах.
 */

import type { AdminRow } from '@/components/data/data-table';
import { limits } from '@/config/business';
import type { AdminListParams } from '@/config/routes';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';

const PAGE_SIZE = limits.pagination.defaultPageSize;

export interface OperationsPage {
  rows: readonly AdminRow[];
  total: number;
  page: number;
  pageCount: number;
}

function paging(query: AdminListParams): { skip: number; take: number; page: number } {
  const page = Math.max(query.page ?? 1, 1);
  return { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, page };
}

function page(rows: readonly AdminRow[], total: number, current: number): OperationsPage {
  return { rows, total, page: current, pageCount: Math.max(Math.ceil(total / PAGE_SIZE), 1) };
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/* ──────────────────────────────── Заказы ──────────────────────────────── */

export async function listOrders(query: AdminListParams): Promise<OperationsPage> {
  const { skip, take, page: current } = paging(query);

  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status as Prisma.OrderWhereInput['status'] } : {}),
    ...(query.q
      ? {
          OR: [
            { orderNumber: { contains: query.q, mode: 'insensitive' } },
            { contactEmail: { contains: query.q, mode: 'insensitive' } },
            { contactName: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      skip,
      take,
      orderBy: { placedAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        contactName: true,
        total: true,
        placedAt: true,
        paidAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  return page(
    rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      contactName: row.contactName,
      total: row.total,
      itemCount: row._count.items,
      placedAt: iso(row.placedAt),
      paidAt: iso(row.paidAt),
    })),
    total,
    current,
  );
}

export async function getOrderDetail(id: string) {
  return db.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      deliveryMethod: true,
      deliveryNotes: true,
      subtotal: true,
      discountTotal: true,
      deliveryFee: true,
      vatAmount: true,
      vatRate: true,
      total: true,
      placedAt: true,
      paidAt: true,
      shippedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      items: {
        select: {
          id: true,
          type: true,
          titleSnapshot: true,
          quantity: true,
          unitPrice: true,
          discountAmount: true,
          lineTotal: true,
        },
      },
      payments: {
        select: {
          id: true,
          provider: true,
          method: true,
          status: true,
          amount: true,
          paidAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

/* ──────────────────────────────── Брони ──────────────────────────────── */

export async function listBookings(query: AdminListParams): Promise<OperationsPage> {
  const { skip, take, page: current } = paging(query);

  const where: Prisma.BookingWhereInput = {
    ...(query.status ? { status: query.status as Prisma.BookingWhereInput['status'] } : {}),
    ...(query.q
      ? {
          OR: [
            { reference: { contains: query.q, mode: 'insensitive' } },
            { customer: { name: { contains: query.q, mode: 'insensitive' } } },
            { customer: { email: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.booking.findMany({
      where,
      skip,
      take,
      orderBy: { startsAt: 'desc' },
      select: {
        id: true,
        reference: true,
        subject: true,
        status: true,
        startsAt: true,
        participants: true,
        totalPrice: true,
        customer: { select: { name: true } },
      },
    }),
    db.booking.count({ where }),
  ]);

  return page(
    rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      subject: row.subject,
      status: row.status,
      startsAt: iso(row.startsAt),
      customerName: row.customer.name,
      participants: row.participants,
      totalPrice: row.totalPrice,
    })),
    total,
    current,
  );
}

export async function getBookingDetail(id: string) {
  return db.booking.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      subject: true,
      status: true,
      startsAt: true,
      endsAt: true,
      participants: true,
      locationOption: true,
      customerAddress: true,
      basePrice: true,
      travelFee: true,
      discountAmount: true,
      totalPrice: true,
      cancellationWindowHours: true,
      lateCancellationRate: true,
      rescheduleWindowHours: true,
      maxReschedules: true,
      rescheduleCount: true,
      cancelledAt: true,
      cancellationReason: true,
      completedAt: true,
      notes: true,
      createdAt: true,
      customer: { select: { id: true, name: true, email: true } },
      instructor: { select: { slug: true, user: { select: { name: true } } } },
      venue: { select: { name: true } },
      room: { select: { name: true } },
      payments: {
        select: { id: true, status: true, amount: true, paidAmount: true, method: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

/* ─────────────────────────────── Выплаты ─────────────────────────────── */

export async function listPayouts(query: AdminListParams): Promise<OperationsPage> {
  const { skip, take, page: current } = paging(query);

  const where: Prisma.PayoutWhereInput = {
    ...(query.status ? { status: query.status as Prisma.PayoutWhereInput['status'] } : {}),
    ...(query.q ? { reference: { contains: query.q, mode: 'insensitive' } } : {}),
  };

  const [rows, total] = await Promise.all([
    db.payout.findMany({
      where,
      skip,
      take,
      orderBy: { periodEnd: 'desc' },
      select: {
        id: true,
        reference: true,
        status: true,
        amount: true,
        periodStart: true,
        periodEnd: true,
        processedAt: true,
        account: {
          select: {
            accountName: true,
            accountMasked: true,
            method: true,
            instructor: { select: { user: { select: { name: true } } } },
            venue: { select: { name: true } },
          },
        },
      },
    }),
    db.payout.count({ where }),
  ]);

  return page(
    rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      status: row.status,
      recipient: row.account.instructor?.user.name ?? row.account.venue?.name ?? row.account.accountName,
      accountMasked: row.account.accountMasked,
      amount: row.amount,
      periodStart: iso(row.periodStart),
      periodEnd: iso(row.periodEnd),
      processedAt: iso(row.processedAt),
    })),
    total,
    current,
  );
}

/* ────────────────────────────── Модерация ────────────────────────────── */

export type ModerationTab = 'reviews' | 'instructors' | 'venues';

export interface ModerationItem {
  id: string;
  title: string;
  body: string;
  author: string;
  target: string | null;
  rating: number | null;
  createdAt: string | null;
}

export async function listModerationQueue(
  tab: ModerationTab,
  query: AdminListParams,
): Promise<{ items: readonly ModerationItem[]; total: number }> {
  const take = PAGE_SIZE;
  const status = (query.status ?? 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED';

  if (tab === 'reviews') {
    const where: Prisma.ReviewWhereInput = { moderation: status };
    const [rows, total] = await Promise.all([
      db.review.findMany({
        where,
        take,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          rating: true,
          createdAt: true,
          author: { select: { name: true } },
          instructor: { select: { user: { select: { name: true } } } },
          danceClass: { select: { title: true } },
          product: { select: { title: true } },
          venue: { select: { name: true } },
        },
      }),
      db.review.count({ where }),
    ]);

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        title: row.author.name,
        body: row.body,
        author: row.author.name,
        target:
          row.instructor?.user.name ?? row.danceClass?.title ?? row.product?.title ?? row.venue?.name ?? null,
        rating: row.rating,
        createdAt: iso(row.createdAt),
      })),
    };
  }

  if (tab === 'instructors') {
    const where: Prisma.InstructorProfileWhereInput = { moderation: status };
    const [rows, total] = await Promise.all([
      db.instructorProfile.findMany({
        where,
        take,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          slug: true,
          headline: true,
          bio: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      db.instructorProfile.count({ where }),
    ]);

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        title: row.user.name,
        body: `${row.headline}\n\n${row.bio}`,
        author: row.user.name,
        target: row.slug,
        rating: null,
        createdAt: iso(row.createdAt),
      })),
    };
  }

  const where: Prisma.VenueWhereInput = { moderation: status };
  const [rows, total] = await Promise.all([
    db.venue.findMany({
      where,
      take,
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, description: true, district: true, createdAt: true },
    }),
    db.venue.count({ where }),
  ]);

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      title: row.name,
      body: row.description,
      author: row.district,
      target: row.district,
      rating: null,
      createdAt: iso(row.createdAt),
    })),
  };
}
