import { Ionicons } from '@expo/vector-icons';
import { GlassBackdrop } from '@/components/ui/glass-backdrop';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FadeImage } from '@/components/ui/fade-image';
import { GlassButton } from '@/components/ui/glass-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { getCurrentUser } from '@/lib/auth';
import { claimWaitlistHold, createRecurringSeries, joinClassWaitlist, listClassSessions, quoteBooking, type BookingQuote } from '@/lib/bookings';
import { getCatalogDetail, mediaUri } from '@/lib/catalog';
import { API_URL } from '@/lib/config';
import { useEntitlements } from '@/lib/entitlements';
import { dateLabel, initials, plural, price, studioDayKey } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { paymentOutcomeText, paymentReturnUrl, type PaymentStart, startPayment as runPayment } from '@/lib/payment-url';
import { resolveServerMessage, serverMessageOf } from '@/lib/server-message';
import { getSessionToken } from '@/lib/session';
import { colors, fill, fonts, gradients, radius, space, type } from '@/theme';

type Slot = {
  startIso: string;
  startTime: string;
  endTime: string;
  endIso: string;
  sessionId?: string;
  available?: boolean;
  spotsLeft?: number;
  waitlist?: { position: number; claimable: boolean } | null;
};
type Availability = { instructorSlug: string; slots: Slot[] };
type Failure = { error?: string; messageKey?: string; params?: Record<string, string | number> };
type PayMethod = 'CARD' | 'ARCA' | 'IDRAM' | 'TELCELL';
type IconName = ComponentProps<typeof Ionicons>['name'];
type Instructor = { name?: string; headline?: string; image?: { key?: string }; ratingAverage?: number };

// ARCA_QR не предлагается: приложение пока не умеет показать qrPayload провайдера.
const payMethods: {
  id: PayMethod;
  icon: IconName;
  labelKey: 'payMethodCard' | 'payMethodArca' | 'payMethodIdram' | 'payMethodTelcell';
}[] = [
  { id: 'CARD', icon: 'card-outline', labelKey: 'payMethodCard' },
  { id: 'ARCA', icon: 'card', labelKey: 'payMethodArca' },
  { id: 'IDRAM', icon: 'wallet-outline', labelKey: 'payMethodIdram' },
  { id: 'TELCELL', icon: 'phone-portrait-outline', labelKey: 'payMethodTelcell' },
];

class BookingError extends Error {
  constructor(
    readonly code: string,
    readonly serverMessage: string | null = null,
  ) {
    super(code);
  }
}

async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & Failure;
  if (!response.ok) {
    const serverMessage = body.messageKey
      ? resolveServerMessage(body.messageKey, body.params ?? {}, catalogFor(deviceLocale(undefined)))
      : null;
    throw new BookingError(body.error ?? `HTTP ${response.status}`, serverMessage);
  }
  return body;
}

/** Ереван без перехода на летнее время: UTC+4 круглый год. */
const YEREVAN_OFFSET_MS = 4 * 60 * 60 * 1000;

const dayKey = studioDayKey;

/** Заполненное проведение группы: мест нет, бронь возможна только через лист ожидания. */
const isFull = (slot: Slot) => slot.sessionId !== undefined && (slot.spotsLeft ?? 0) <= 0;
const isWaitlistSlot = (slot: Slot) => isFull(slot) && !slot.waitlist?.claimable;

/** Максимум недель в серии, как `recurring.maxWeeks` в `src/config/business.ts`; 1 неделя — обычная бронь. */
const RECURRING_MAX_WEEKS = 12;

/** День недели в Ереване в формате `Date.getDay()`: 0 — воскресенье. */
const yerevanWeekday = (iso: string) => new Date(Date.parse(iso) + YEREVAN_OFFSET_MS).getUTCDay();

export default function BookScreen() {
  const { instructor, classSlug } = useLocalSearchParams<{ instructor: string; classSlug?: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const insets = useSafeAreaInsets();

  const [slots, setSlots] = useCachedState<Slot[]>(`book.slots.${instructor}`, 'public');
  const [profile, setProfile] = useCachedState<Instructor>(`content.instructor.${instructor}`, 'public');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string; paying?: boolean } | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('CARD');
  const [pairOnly, setPairOnly] = useState(false);
  const [weeks, setWeeks] = useState(1);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const entitlements = useEntitlements();
  const recurringEnabled = entitlements?.recurring === true;

  useEffect(() => {
    let alive = true;
    getCurrentUser().then((user) => {
      if (alive) setSignedIn(user !== null);
    });
    getCatalogDetail<Instructor>('instructors', instructor)
      .then((data) => alive && setProfile(data))
      .catch(() => undefined);
    const request: Promise<{ slots: Slot[]; pair: boolean }> = classSlug
      ? listClassSessions(instructor, classSlug).then((data) => ({ slots: data.slots, pair: data.lessonType === 'PAIR' }))
      : fetch(`${API_URL}/api/availability?instructor=${encodeURIComponent(instructor)}&count=20`)
          .then((response) => readJson<Availability>(response))
          .then((data) => ({ slots: data.slots, pair: false }));
    request
      .then((data) => {
        if (alive) {
          setSlots(data.slots);
          setPairOnly(data.pair);
        }
      })
      .catch((err: unknown) => {
        if (alive) setLoadError(err instanceof BookingError ? err.code : 'network');
      });
    return () => {
      alive = false;
    };
  }, [instructor, classSlug]);

  // Цена выбранного слота до подтверждения: сервер считает её так же, как при брони.
  useEffect(() => {
    setQuote(null);
    if (!selected || isWaitlistSlot(selected)) return;
    const controller = new AbortController();
    quoteBooking(
      { instructor, startsAt: selected.startIso, sessionId: selected.sessionId, weeks: recurringEnabled && !classSlug ? weeks : 1 },
      controller.signal,
    )
      .then(setQuote)
      .catch(() => undefined);
    return () => controller.abort();
  }, [selected, weeks, instructor, classSlug, recurringEnabled]);

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots ?? []) {
      const key = dayKey(slot.startIso);
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return [...map.entries()].map(([key, list]) => ({ key, iso: list[0].startIso, slots: list }));
  }, [slots]);

  const activeDay = days.find((d) => d.key === day) ?? days[0];

  const barLabel =
    selected && isFull(selected)
      ? selected.waitlist?.claimable
        ? c.booking.waitlistClaim
        : c.common.actions.joinWaitlist
      : t.bookConfirm;

  async function refreshSlots(): Promise<Slot[]> {
    if (classSlug) return (await listClassSessions(instructor, classSlug)).slots;
    const refreshed = await fetch(`${API_URL}/api/availability?instructor=${encodeURIComponent(instructor)}&count=20`).then(
      (response) => readJson<Availability>(response),
    );
    return refreshed.slots;
  }

  /** Обновление слотов после брони — фоновое: его ошибка не должна выглядеть как неудачная бронь. */
  function refreshSlotsInBackground() {
    refreshSlots()
      .then(setSlots)
      .catch(() => undefined);
  }

  /** Открывает оплату уже созданной брони. Бронь действительна и без предоплаты. */
  async function startPayment(bookingId: string) {
    try {
      const payResponse = await authed(`/api/booking/${bookingId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ method: payMethod, locale, fromApp: true, returnTo: paymentReturnUrl(), inAppSheet: true }),
      });
      const payment = await readJson<PaymentStart>(payResponse);
      const outcome = await runPayment(payment);
      if (outcome !== 'UNAVAILABLE') {
        setResult({ kind: 'success', text: paymentOutcomeText(outcome, t), paying: true });
        return;
      }
    } catch {
      // Неудачный старт оплаты не отменяет бронь: оплатить можно из «Моих записей».
    }
    setResult({ kind: 'success', text: `${t.bookPayFailed}. ${t.bookPayLater}`, paying: true });
  }

  async function confirm() {
    if (!selected || busy) return;
    setBusy(true);
    setResult(null);
    try {
      if (classSlug && selected.sessionId && isWaitlistSlot(selected)) {
        if (!selected.waitlist) {
          const { waitlist } = await joinClassWaitlist(selected.sessionId);
          Alert.alert(c.booking.waitlistTitle, c.booking.waitlistJoined.replace('{n}', String(waitlist.position)));
          setSelected(null);
          setSlots(await refreshSlots());
        } else {
          Alert.alert(c.booking.waitlistTitle, c.booking.waitlistJoined.replace('{n}', String(selected.waitlist.position)));
        }
        return;
      }

      if (recurringEnabled && !classSlug && weeks > 1) {
        // Серия создаётся сразу, без удержания: сервер бронирует каждую дату. Оплачиваем первую бронь, как на сайте.
        const series = await createRecurringSeries({
          instructorId: instructor,
          startsAt: selected.startIso,
          weekday: yerevanWeekday(selected.startIso),
          startTime: selected.startTime,
          durationMinutes: Math.round((Date.parse(selected.endIso) - Date.parse(selected.startIso)) / 60000),
          weeks,
        });
        setSelected(null);
        refreshSlotsInBackground();
        const first = series.bookings[0];
        if (first) await startPayment(first.id);
        else setResult({ kind: 'error', text: t.bookSlotTaken });
        return;
      }

      let holdId: string;
      if (classSlug && selected.sessionId && selected.waitlist?.claimable) {
        const { hold } = await claimWaitlistHold(selected.sessionId);
        holdId = hold.id;
      } else {
        const holdResponse = await authed('/api/booking/hold', {
          method: 'POST',
          body: JSON.stringify(
            selected.sessionId
              ? { instructorId: instructor, sessionId: selected.sessionId, startsAt: selected.startIso, endsAt: selected.endIso }
              : { instructorId: instructor, startsAt: selected.startIso, endsAt: selected.endIso },
          ),
        });
        const { hold } = await readJson<{ hold: { id: string } }>(holdResponse);
        holdId = hold.id;
      }

      const bookingResponse = await authed('/api/booking', { method: 'POST', body: JSON.stringify({ holdId }) });
      const { booking } = await readJson<{ booking: { id: string; totalPrice: number } }>(bookingResponse);
      setSelected(null);
      refreshSlotsInBackground();

      if (booking.totalPrice > 0) {
        await startPayment(booking.id);
      } else {
        setResult({ kind: 'success', text: t.bookDone });
      }
    } catch (err: unknown) {
      const code = err instanceof BookingError ? err.code : '';
      setResult({ kind: 'error', text: code === 'SLOT_CONFLICT' || code === 'SLOT_UNAVAILABLE' ? t.bookSlotTaken : (serverMessageOf(err) ?? t.bookFailed) });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!result) return;
    Haptics.notificationAsync(
      result.kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => undefined);
  }, [result]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <GlassButton icon="chevron-down" label={t.catalogBack} onPress={close} />
      <Text style={styles.headerTitle}>{t.bookTitle}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (result?.kind === 'success') {
    return (
      <View style={[styles.screen, styles.successScreen]}>
        <LinearGradient colors={['rgba(63,185,132,0.18)', 'rgba(11,8,9,0)']} style={styles.successGlow} />
        <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.successRing}>
          <Ionicons name="checkmark" size={54} color={colors.white} />
        </Animated.View>
        <Animated.Text entering={FadeInUp.delay(200).duration(500)} style={styles.successTitle}>
          {t.bookSuccessTitle}
        </Animated.Text>
        <Animated.Text entering={FadeInUp.delay(300).duration(500)} style={[type.body, styles.center]}>
          {result.text}
        </Animated.Text>
        <Animated.View entering={FadeInUp.delay(420).duration(500)} style={styles.successAction}>
          {result.paying ? (
            <Button label={c.account.nav.bookings} onPress={() => router.replace('/account/bookings')} />
          ) : null}
          <Button label={c.common.actions.continue} onPress={close} variant={result.paying ? 'ghost' : 'primary'} />
        </Animated.View>
      </View>
    );
  }

  if (signedIn === false) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState icon="lock-closed-outline" title={t.bookSignIn} actionLabel={t.signInAction} onAction={() => router.push('/sign-in')} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState icon="cloud-offline-outline" title={t.catalogError} actionLabel={t.catalogBack} onAction={close} />
      </View>
    );
  }

  if (pairOnly) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState icon="people-outline" title={c.booking.pairOnWeb} actionLabel={t.catalogBack} onAction={close} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.person}>
          <View style={styles.avatar}>
            {profile?.image?.key ? (
              <FadeImage uri={mediaUri(profile.image.key)} />
            ) : (
              <Text style={styles.avatarText}>{initials(profile?.name ?? instructor)}</Text>
            )}
          </View>
          <View style={styles.flex}>
            {profile?.name ? <Text style={type.h3}>{profile.name}</Text> : <Skeleton width="60%" height={18} />}
            {profile?.headline ? (
              <Text style={type.caption} numberOfLines={2}>
                {profile.headline}
              </Text>
            ) : null}
          </View>
          {profile?.ratingAverage ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={12} color={colors.metal} />
              <Text style={styles.ratingText}>{profile.ratingAverage.toFixed(1)}</Text>
            </View>
          ) : null}
        </Animated.View>

        <Text style={[type.eyebrow, styles.padded]}>{c.common.labels.date}</Text>
        {slots === null ? (
          <View style={[styles.dayRow, styles.padded]}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width={62} height={84} radius={radius.lg} />
            ))}
          </View>
        ) : days.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" title={t.bookNoSlots} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.dayRow, styles.padded]}>
            {days.map((d, index) => {
              const active = d.key === activeDay?.key;
              return (
                <Animated.View key={d.key} entering={FadeInDown.delay(index * 40).duration(400)}>
                  <PressableScale
                    onPress={() => {
                      setDay(d.key);
                      setSelected(null);
                    }}
                    style={[styles.day, active && styles.dayActive]}
                    accessibilityState={{ selected: active }}
                  >
                    {active ? (
                      <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    ) : null}
                    <Text style={[styles.dayWeek, active && styles.dayTextActive]}>{dateLabel(d.iso, locale, { weekday: 'short' })}</Text>
                    <Text style={[styles.dayNum, active && styles.dayTextActive]}>{dateLabel(d.iso, locale, { day: 'numeric' })}</Text>
                    <Text style={[styles.dayMonth, active && styles.dayTextActive]}>{dateLabel(d.iso, locale, { month: 'short' })}</Text>
                  </PressableScale>
                </Animated.View>
              );
            })}
          </ScrollView>
        )}

        {activeDay ? (
          <>
            <Text style={[type.eyebrow, styles.padded, styles.sectionGap]}>{t.bookPickSlot}</Text>
            <Animated.View key={activeDay.key} entering={FadeIn.duration(300)} style={[styles.times, styles.padded]}>
              {activeDay.slots.map((slot) => {
                const active = selected?.startIso === slot.startIso;
                const off = slot.available === false && !isFull(slot);
                return (
                  <PressableScale
                    key={slot.startIso}
                    onPress={() => {
                      if (!off) setSelected(slot);
                    }}
                    style={[styles.time, active && styles.timeActive, off && styles.timeOff]}
                    accessibilityState={{ selected: active, disabled: off }}
                  >
                    <Text style={[styles.timeText, active && styles.timeTextActive]}>{slot.startTime}</Text>
                    <Text style={[styles.timeEnd, active && styles.timeEndActive]}>
                      {isFull(slot) ? c.booking.sessionFull : `– ${slot.endTime}`}
                    </Text>
                  </PressableScale>
                );
              })}
            </Animated.View>
          </>
        ) : null}

        {recurringEnabled && !classSlug && selected ? (
          <Animated.View entering={FadeInDown.duration(400)} layout={LinearTransition} style={styles.padded}>
            <Text style={[type.eyebrow, styles.sectionGap, styles.payTitle]}>{c.booking.recurring.weeks}</Text>
            <View style={styles.stepper}>
              <PressableScale
                onPress={() => setWeeks((w) => Math.max(1, w - 1))}
                disabled={weeks <= 1}
                style={[styles.stepBtn, weeks <= 1 && styles.timeOff]}
                accessibilityRole="button"
                accessibilityState={{ disabled: weeks <= 1 }}
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </PressableScale>
              <Text style={styles.stepValue}>{weeks}</Text>
              <PressableScale
                onPress={() => setWeeks((w) => Math.min(RECURRING_MAX_WEEKS, w + 1))}
                disabled={weeks >= RECURRING_MAX_WEEKS}
                style={[styles.stepBtn, weeks >= RECURRING_MAX_WEEKS && styles.timeOff]}
                accessibilityRole="button"
                accessibilityState={{ disabled: weeks >= RECURRING_MAX_WEEKS }}
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </PressableScale>
            </View>
            <Text style={[type.caption, styles.stepHint]}>
              {weeks > 1
                ? c.booking.recurring.hint.replace(/\{weeks, plural,.*?\}\}/, (placeholder) =>
                    plural(placeholder.replace('{weeks,', '{count,'), weeks, locale),
                  )
                : c.booking.recurring.singleHint}
            </Text>
          </Animated.View>
        ) : null}

        {selected && !isWaitlistSlot(selected) ? (
          <Animated.View entering={FadeInDown.duration(400)} layout={LinearTransition} style={styles.padded}>
            <Text style={[type.eyebrow, styles.sectionGap, styles.payTitle]}>{t.payMethodTitle}</Text>
            <View style={styles.payList}>
              {payMethods.map((method, index) => {
                const active = payMethod === method.id;
                return (
                  <PressableScale
                    key={method.id}
                    pressedScale={0.98}
                    onPress={() => setPayMethod(method.id)}
                    style={[styles.pay, index > 0 && styles.payDivider]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <View style={[styles.payIcon, active && styles.payIconActive]}>
                      <Ionicons name={method.icon} size={18} color={active ? colors.white : colors.text2} />
                    </View>
                    <Text style={[type.label, styles.flex]}>{t[method.labelKey]}</Text>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <Animated.View entering={ZoomIn.duration(200)} style={styles.radioDot} /> : null}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {selected && quote ? (
          <Animated.Text entering={FadeIn.duration(250)} style={[type.caption, styles.padded]}>
            {c.booking.cancellationNote.replace('{hours}', plural(c.common.units.hours, quote.freeCancellationHours, locale))}
          </Animated.Text>
        ) : null}

        {result?.kind === 'error' ? (
          <Animated.View entering={FadeInDown} style={[styles.errorBanner, styles.paddedMargin]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[type.bodySm, styles.flex, styles.errorText]}>{result.text}</Text>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <GlassBackdrop intensity={60} />
        <View style={styles.barTint} />
        <View style={styles.flex}>
          <Text style={type.caption}>{c.common.labels.time}</Text>
          <Text style={styles.barValue} numberOfLines={1}>
            {selected ? `${dateLabel(selected.startIso, locale, { weekday: 'short', day: 'numeric', month: 'short' })} · ${selected.startTime}` : '—'}
          </Text>
          {selected && quote ? (
            <Animated.Text key={quote.total} entering={FadeIn.duration(200)} style={styles.barPrice} numberOfLines={1}>
              {quote.weeks > 1
                ? `${price(quote.total, locale)} · ${quote.weeks} × ${price(quote.perLesson, locale)}`
                : price(quote.total, locale)}
            </Animated.Text>
          ) : null}
        </View>
        <Button label={barLabel} onPress={confirm} busy={busy} disabled={!selected} style={styles.barButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  padded: { paddingHorizontal: space.xl },
  paddedMargin: { marginHorizontal: space.xl },
  sectionGap: { marginTop: 28 },
  scroll: { paddingBottom: 160, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 22, color: colors.text },
  headerSpacer: { width: 40 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: space.xl,
    marginTop: space.sm,
    marginBottom: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.text },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '700', color: colors.text },
  dayRow: { flexDirection: 'row', gap: 10 },
  day: {
    width: 62,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  dayActive: { borderColor: colors.accentBright },
  dayWeek: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.text3 },
  dayNum: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.text },
  dayMonth: { fontSize: 11, fontWeight: '600', color: colors.text3 },
  dayTextActive: { color: colors.white },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  time: {
    width: '31%',
    flexGrow: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  timeActive: { backgroundColor: colors.text, borderColor: colors.text },
  timeText: { fontSize: 17, fontWeight: '800', color: colors.text },
  timeTextActive: { color: colors.bg },
  timeEnd: { fontSize: 11, color: colors.text3, marginTop: 2 },
  timeEndActive: { color: 'rgba(11,8,9,0.6)' },
  timeOff: { opacity: 0.4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  stepValue: { minWidth: 36, textAlign: 'center', fontFamily: fonts.display, fontSize: 28, color: colors.text },
  stepHint: { marginTop: space.md },
  payTitle: { paddingHorizontal: 0, marginBottom: space.md },
  payList: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  pay: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: space.lg },
  payDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  payIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  payIconActive: { backgroundColor: colors.accent },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.accentBright },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentBright },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: space.lg,
    marginTop: space.lg,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,107,122,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,107,122,0.4)',
  },
  errorText: { color: colors.text },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingTop: 14,
    paddingHorizontal: space.xl,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
  },
  barTint: { ...fill, backgroundColor: 'rgba(11,8,9,0.6)' },
  barValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  barPrice: { fontSize: 13, fontWeight: '700', color: colors.metal, marginTop: 2 },
  barButton: { minWidth: 170 },
  successScreen: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.lg },
  successGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  successRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    marginBottom: space.md,
    shadowColor: colors.success,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
  },
  successTitle: { fontFamily: fonts.display, fontSize: 34, color: colors.text },
  successAction: { alignSelf: 'stretch', marginTop: space.lg, gap: space.md },
});
