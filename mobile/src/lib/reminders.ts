import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { nextClassStart } from './class-time';

const LEAD_MS = 60 * 60 * 1000;

// Показываем баннер даже когда приложение открыто на переднем плане.
// Модуль импортируется из корневого layout, чтобы обработчик стоял при запуске приложения.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('classes', {
    name: 'Занятия',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Ставит локальное напоминание за час до ближайшего занятия.
 * Возвращает false, если пользователь не разрешил уведомления или занятие слишком близко.
 */
export async function scheduleClassReminder(opts: {
  slug: string;
  title: string;
  weekday: number;
  startTime: string;
  remindText: string;
}): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return false;

  const start = nextClassStart(opts.weekday, opts.startTime, Date.now());
  const fireAt = new Date(start.getTime() - LEAD_MS);
  if (fireAt.getTime() <= Date.now()) return false;

  await ensureChannel();
  // Один slug — одно напоминание: старое заменяем, чтобы не плодить дубли.
  await cancelClassReminder(opts.slug);
  await Notifications.scheduleNotificationAsync({
    identifier: `class-${opts.slug}`,
    content: { title: opts.title, body: opts.remindText, data: { slug: opts.slug, section: 'classes' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: 'classes' },
  });
  return true;
}

export async function cancelClassReminder(slug: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`class-${slug}`).catch(() => undefined);
}

const BOOKING_PREFIX = 'booking-';

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function scheduleBookingOne(opts: { bookingId: string; title: string; startsAt: string; body: string }): Promise<boolean> {
  const fireAt = new Date(Date.parse(opts.startsAt) - LEAD_MS);
  if (fireAt.getTime() <= Date.now()) return false;

  await ensureChannel();
  const identifier = `${BOOKING_PREFIX}${opts.bookingId}`;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title: opts.title, body: opts.body, data: { bookingId: opts.bookingId, section: 'account' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: 'classes' },
  });
  return true;
}

/**
 * Напоминание за час до занятия, которое клиент записал из чата.
 * Запрашивает разрешение: вызывается сразу после подтверждённой записи.
 */
export async function scheduleBookingReminder(opts: {
  bookingId: string;
  title: string;
  startsAt: string;
  body: string;
}): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  return scheduleBookingOne(opts);
}

/**
 * Сверяет напоминания с активными бронями: ставит недостающие и снимает напоминания
 * отменённых или прошедших броней. Разрешение не запрашивает, только использует выданное.
 */
export async function syncBookingReminders(
  bookings: { id: string; title: string; startsAt: string; active: boolean }[],
  body: string,
): Promise<void> {
  const current = await Notifications.getPermissionsAsync().catch(() => null);
  if (!current?.granted) return;

  const wanted = new Set(bookings.filter((item) => item.active).map((item) => `${BOOKING_PREFIX}${item.id}`));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const item of scheduled) {
    const identifier = item.identifier;
    if (identifier.startsWith(BOOKING_PREFIX) && !wanted.has(identifier)) {
      await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
    }
  }

  for (const item of bookings) {
    if (!item.active) continue;
    await scheduleBookingOne({ bookingId: item.id, title: item.title, startsAt: item.startsAt, body }).catch(() => undefined);
  }
}
