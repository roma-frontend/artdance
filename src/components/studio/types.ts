/** Типы строк расписания, которыми страница кормит редактор. */

export interface ScheduleRuleItem {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export interface ScheduleExceptionItem {
  id: string;
  /** ISO-строка: дата и время начала/конца исключения. */
  startsAt: string;
  endsAt: string;
  isAvailable: boolean;
  reason: string | null;
}
