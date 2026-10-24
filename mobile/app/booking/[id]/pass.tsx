import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  type BookingPass,
  type ClientBookingDetail,
} from '@/lib/bookings';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

export default function BookingPassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const f = c.footer;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pass, setPass] = useState<BookingPass | null>(null);
  const [booking, setBooking] = useState<ClientBookingDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextPass, nextBooking] = await Promise.all([getBookingPass(id), getMyBooking(id).catch(() => null)]);
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

  async function runCancel() {
    setCancelling(true);
    try {
      const result = await cancelMyBooking(id);
      const rate = result.booking.totalPrice > 0 ? Math.round((result.fee / result.booking.totalPrice) * 100) : 0;
      Alert.alert(result.outcome === 'fee' ? c.booking.cancelLate.replace('{rate}', `${rate}%`) : c.booking.cancelFree);
      await load();
    } catch (error) {
      Alert.alert(serverMessageOf(error) ?? c.booking.cancelForbidden);
    } finally {
      setCancelling(false);
    }
  }

  async function onPay() {
    setPaying(true);
    try {
      const { redirectUrl } = await payBooking(id, 'CARD');
      if (redirectUrl) await Linking.openURL(redirectUrl);
      else Alert.alert(t.bookPayFailed);
    } catch (error) {
      Alert.alert(serverMessageOf(error) ?? t.bookPayFailed);
    } finally {
      setPaying(false);
    }
  }

  function confirmCancel() {
    Alert.alert(c.booking.cancelTitle, undefined, [
      { text: c.common.actions.back, style: 'cancel' },
      { text: c.common.actions.cancel, style: 'destructive', onPress: runCancel },
    ]);
  }

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={type.h2}>{f.passTitle}</Text>
    </Animated.View>
  );

  if (!pass) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        {failed !== null ? (
          <EmptyState icon="alert-circle-outline" title={failed} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accentBright} />
          </View>
        )}
      </View>
    );
  }

  const cancelled = booking ? isCancelledBooking(booking.status) : false;
  const canCancel = booking ? canCancelBooking(booking) : false;
  const canReschedule = booking ? canRescheduleBooking(booking) : false;
  const canPay = booking ? canPayBooking(booking) : false;
  const canReview = booking ? canReviewBooking(booking) : false;
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
        ) : (
          <>
            <Animated.View entering={ZoomIn.delay(160).duration(420).easing(EASE_OUT)} style={styles.qrFrame}>
              <QRCode value={pass.qrData} size={220} color="#000000" backgroundColor="#FFFFFF" />
            </Animated.View>
            <Text style={styles.tip}>{f.passFooterTip}</Text>
          </>
        )}
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
