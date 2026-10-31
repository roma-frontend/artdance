/**
 * АНАЛИТИКА ИНСТРУКТОРА — сводка за окно по броням, без обращения к базе.
 *
 * Сервер выбирает брони инструктора, функция считает показатели. Правила подсчёта
 * (что считается выручкой, что явкой, что отменой) живут здесь, поэтому их можно
 * проверить без базы.
 *
 * Окно — `windowDays` дней до `now`, по дате начала брони. Брони с будущим
 * стартом не входят: по ним ещё нет результата.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Статусы брони из `BookingStatus`; объявлены здесь, чтобы домен не тянул Prisma. */
export type InstructorBookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED_BY_CUSTOMER'
  | 'CANCELLED_BY_PROVIDER'
  | 'NO_SHOW'
  | 'RESCHEDULED'
  | 'WAITLISTED'
  | 'EXPIRED';

export interface InstructorBookingRow {
  status: InstructorBookingStatus;
  customerId: string;
  totalPrice: number;
  startsAt: Date;
}

export interface InstructorBookingSummary {
  windowDays: number;
  /** Занятия, которые состоялись: отмечены как COMPLETED. */
  completed: number;
  /** Отменены клиентом или инструктором. */
  cancelled: number;
  /** Не пришли. */
  noShows: number;
  /** Подтверждены, но ещё без отметки о результате. */
  unmarked: number;
  /** Сумма броней, которые состоялись, до комиссии площадки. */
  revenue: number;
  /** Средний чек по состоявшимся броням; null, если ни одной нет. */
  averageCheck: number | null;
  /** Доля пришедших: completed / (completed + noShows), от 0 до 1; null без данных. */
  attendanceRate: number | null;
  /** Уникальные клиенты, у которых состоялось занятие. */
  uniqueClients: number;
  /** Клиенты, у которых состоялось два занятия и больше. */
  returningClients: number;
}

const CANCELLED: ReadonlySet<InstructorBookingStatus> = new Set(['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_PROVIDER']);

export function summarizeInstructorBookings(
  rows: readonly InstructorBookingRow[],
  now: Date,
  windowDays: number,
): InstructorBookingSummary {
  const nowMs = now.getTime();
  const fromMs = nowMs - windowDays * DAY_MS;

  let completed = 0;
  let cancelled = 0;
  let noShows = 0;
  let unmarked = 0;
  let revenue = 0;
  const completedByClient = new Map<string, number>();

  for (const row of rows) {
    const startMs = row.startsAt.getTime();
    if (startMs < fromMs || startMs >= nowMs) continue;

    if (row.status === 'COMPLETED') {
      completed += 1;
      revenue += row.totalPrice;
      completedByClient.set(row.customerId, (completedByClient.get(row.customerId) ?? 0) + 1);
    } else if (CANCELLED.has(row.status)) {
      cancelled += 1;
    } else if (row.status === 'NO_SHOW') {
      noShows += 1;
    } else if (row.status === 'CONFIRMED') {
      unmarked += 1;
    }
    // PENDING, RESCHEDULED, WAITLISTED и EXPIRED в сводку не входят: это не исход занятия.
  }

  const attended = completed + noShows;
  let returningClients = 0;
  for (const count of completedByClient.values()) {
    if (count >= 2) returningClients += 1;
  }

  return {
    windowDays,
    completed,
    cancelled,
    noShows,
    unmarked,
    revenue,
    averageCheck: completed > 0 ? Math.round(revenue / completed) : null,
    attendanceRate: attended > 0 ? completed / attended : null,
    uniqueClients: completedByClient.size,
    returningClients,
  };
}
