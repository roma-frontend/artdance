import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import {
  bookingStatusLabel,
  canCancelBooking,
  canPayBooking,
  canReviewBooking,
  cancelMyBooking,
  canRescheduleBooking,
  getBookingPass,
  getMyBooking,
  isCancelledBooking,
  payBooking,
  quoteCancellation,
  type BookingPass,
  type ClientBookingDetail,
} from '@/lib/bookings';
import { addBookingToCalendar } from '@/lib/calendar';
import { useEntitlements } from '@/lib/entitlements';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { nextClassProps } from '@/lib/next-class';
import { paymentOutcomeText, startPayment } from '@/lib/payment-url';
import { endNextClassActivities, nativeWidgetsAvailable, startNextClassActivity } from '@/lib/native-widgets';
import { serverMessageOf } from '@/lib/server-message';
import { useAppActive } from '@/lib/use-app-active';
import { useBrightnessBoost } from '@/lib/use-brightness-boost';
import { colors, radius, space, type } from '@/theme';

/** Подписи действий пропуска. Копия локальная, как и в карточке занятия. */
const PASS_ACTIONS: Record<string, { calendar: string; liveActivity: string }> = {
  ru: { calendar: 'Добавить в календарь', liveActivity: 'Показать на экране блокировки' },
  en: { calendar: 'Add to calendar', liveActivity: 'Show on lock screen' },
  hy: { calendar: 'Ավելացնել օրացույցում', liveActivity: 'Ցույց տալ կողպէքրանին' },
};

export default function BookingPassScreen() {
  return <BookingPassContent />;
}

function BookingPassContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const f = c.footer;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const entitlements = useEntitlements();
  const calendarOn = entitlements?.calendarSync === true;
  const liveActivitiesOn = entitlements?.liveActivities === true;
  const actions = PASS_ACTIONS[locale] ?? PASS_ACTIONS.en;
  const [pass, setPass] = useCachedState<BookingPass>(`booking.pass.${id}`, 'user');
  const [booking, setBooking] = useCachedState<ClientBookingDetail>(`booking.detail.${id}`, 'user');
  const [failed, setFailed] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextPass, nextBooking] = await Promise.all([getBookingPass(id), getMyBooking(id)]);
      setPass(nextPass);
      setBooking(nextBooking);
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useAppActive(load);
  useBrightnessBoost(pass !== null && (booking?.status === 'PENDING' || booking?.status === 'CONFIRMED'));

  async function runCancel() {
    setCancelling(true);
    try {
      const result = await cancelMyBooking(id);
      endNextClassActivities().catch(() => undefined);
      const rate = result.booking.totalPrice > 0 ? Math.round((result.fee / result.booking.totalPrice) * 100) : 0;
      Alert.alert(result.outcome === 'fee' ? c.booking.cancelLate.replace('{rate}', `${rate}%`) : c.booking.cancelFree);
      await load();
    } catch (error) {
      Alert.alert(serverMessageOf(error) ?? c.booking.cancelForbidden);
    } finally {
      setCancelling(false);
    }
  }

  async function onCalendar() {
    if (!booking) return;
    try {
      await addBookingToCalendar({
        title: booking.classTitle ?? 'ArtDance',
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        venue: booking.venueName ?? undefined,
        url: `artdance://booking/${id}/pass`,
      });
    } catch (error) {
      Alert.alert(error instanceof Error ? error.message : String(error));
    }
  }

  async function onLiveActivity() {
    if (!booking) return;
    const started = await startNextClassActivity(nextClassProps(booking, locale), new Date(booking.endsAt)).catch(() => false);
    if (!started) Alert.alert(t.catalogError);
  }

  async function onPay() {
    if (paying) return;
    setPaying(true);
    try {
      const payment = await payBooking(id, 'CARD');
      const outcome = await startPayment(payment);
      if (outcome === 'PAID') await load();
      Alert.alert(paymentOutcomeText(outcome, t));
    } catch (error) {
      Alert.alert(serverMessageOf(error) ?? t.bookPayFailed);
    } finally {
      setPaying(false);
    }
  }

  /** Перед отменой сервер считает штраф и возврат: человек соглашается с цифрами, а не узнаёт их после. */
  async function confirmCancel() {
    if (cancelling) return;
    setCancelling(true);
    let message: string | undefined;
    try {
      const quote = await quoteCancellation(id);
      if (quote.kind === 'forbidden') {
        Alert.alert(c.booking.cancelForbidden);
        return;
      }
      const lines =
        quote.kind === 'fee'
          ? [c.booking.cancelLate.replace('{rate}', `${Math.round(quote.rate * 100)}%`), t.cancelWithheld.replace('{amount}', price(quote.fee, locale))]
          : [c.booking.cancelFree];
      if (quote.refund > 0) lines.push(t.cancelRefund.replace('{amount}', price(quote.refund, locale)));
      message = lines.join('\n');
    } catch (error) {
      Alert.alert(serverMessageOf(error) ?? t.catalogError);
      return;
    } finally {
      setCancelling(false);
    }
    Alert.alert(c.booking.cancelTitle, message, [
      { text: c.common.actions.back, style: 'cancel' },
      { text: c.common.actions.cancel, style: 'destructive', onPress: runCancel },
    ]);
  }

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.catalogBack}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={type.h2}>{f.passTitle}</Text>
    </Animated.View>
  );

  if (!pass || !booking) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        {failed !== null ? (
          <EmptyState icon="alert-circle-outline" title={failed} actionLabel={c.common.actions.retry} onAction={load} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accentBright} />
          </View>
        )}
      </View>
    );
  }

  const cancelled = isCancelledBooking(booking.status);
  // QR только для активной брони: истёкшая или завершённая не должна выглядеть как пропуск.
  const passActive = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
  const canCancel = canCancelBooking(booking);
  const canReschedule = canRescheduleBooking(booking);
  const canPay = canPayBooking(booking);
  const canReview = canReviewBooking(booking);
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Animated.View entering={enterItem(0)} style={styles.card}>
          <Text style={type.h3}>{booking?.classTitle ?? pass.reference}</Text>
          {booking?.instructorName ? <Detail label={c.common.labels.instructor} value={booking.instructorName} /> : null}
          {booking?.venueName ? <Detail label={c.common.labels.location} value={booking.venueName} /> : null}
          <Detail label={f.bookingLabel} value={pass.reference} />
          {booking ? (
            <>
              <Detail label={f.startsLabel} value={dateLabel(booking.startsAt, locale, dateOptions)} />
              <Detail label={f.endsLabel} value={dateLabel(booking.endsAt, locale, dateOptions)} />
              {booking.lessonType === 'PAIR' ? (
                <>
                  <Detail label={c.booking.partnerName} value={booking.partnerName ?? '—'} />
                  <Text style={type.bodySm}>{c.booking.pairHint}</Text>
                </>
              ) : null}
              <Detail label={c.common.labels.total} value={price(booking.totalPrice, locale)} />
              {booking.travelFee > 0 ? (
                <Detail label={c.booking.locationCustomer} value={c.booking.locationCustomerNote.replace('{fee}', price(booking.travelFee, locale))} />
              ) : null}
              {booking.cancelledAt ? (
                <Detail label={c.booking.cancelledOnLabel} value={dateLabel(booking.cancelledAt, locale, dateOptions)} />
              ) : null}
              {booking.cancellationReason ? <Detail label={c.booking.cancelledReasonLabel} value={booking.cancellationReason} /> : null}
              <Text style={styles.status}>{bookingStatusLabel(booking.status, c)}</Text>
            </>
          ) : null}
        </Animated.View>

        {passActive && calendarOn ? <Button label={actions.calendar} variant="ghost" onPress={onCalendar} /> : null}

        {passActive && liveActivitiesOn && nativeWidgetsAvailable() ? (
          <Button label={actions.liveActivity} variant="ghost" onPress={onLiveActivity} />
        ) : null}

        {canPay ? <Button label={t.payBookingCta} onPress={onPay} busy={paying} /> : null}

        {canCancel ? (
          <Button label={c.common.actions.cancel} onPress={confirmCancel} variant="ghost" busy={cancelling} />
        ) : null}

        {canReschedule ? (
          <Button
            label={c.booking.rescheduleTitle}
            variant="ghost"
            onPress={() => router.push({ pathname: '/booking/[id]/reschedule', params: { id, instructor: booking?.instructorSlug ?? '' } })}
          />
        ) : null}

        {canReview ? (
          <Button
            label={f.leaveReview}
            variant="ghost"
            onPress={() => router.push({ pathname: '/booking/[id]/review', params: { id } })}
          />
        ) : null}

        {cancelled ? (
          <Text style={type.body}>{f.qrCancelledHint}</Text>
        ) : passActive ? (
          <>
            <Animated.View entering={ZoomIn.delay(160).duration(420).easing(EASE_OUT)} style={styles.qrFrame}>
              <QRCode value={pass.qrData} size={220} color="#000000" backgroundColor="#FFFFFF" />
            </Animated.View>
            <Text style={styles.tip}>{f.passFooterTip}</Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={type.eyebrow}>{label}</Text>
      <Text style={type.body} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.lg },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.md },
  detail: { gap: 4 },
  status: { fontSize: 12, fontWeight: '700', color: colors.metal },
  qrFrame: { alignSelf: 'center', padding: space.lg, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  tip: { ...type.bodySm, textAlign: 'center' },
});
