import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import {
  bookingStatusLabel,
  getBookingPass,
  isCancelledBooking,
  listMyBookings,
  type BookingPass,
  type ClientBooking,
} from '@/lib/bookings';
import { dateLabel } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
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
  const [booking, setBooking] = useState<ClientBooking | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextPass, bookings] = await Promise.all([getBookingPass(id), listMyBookings().catch(() => [])]);
      setPass(nextPass);
      setBooking(bookings.find((item) => item.id === id) ?? null);
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const header = (
    <View style={styles.header}>
      <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={type.h2}>{f.passTitle}</Text>
    </View>
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
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={type.h3}>{booking?.classTitle ?? pass.reference}</Text>
          {booking?.instructorName ? <Detail label={c.common.labels.instructor} value={booking.instructorName} /> : null}
          <Detail label={f.bookingLabel} value={pass.reference} />
          {booking ? (
            <>
              <Detail label={f.startsLabel} value={dateLabel(booking.startsAt, locale, dateOptions)} />
              <Detail label={f.endsLabel} value={dateLabel(booking.endsAt, locale, dateOptions)} />
              <Text style={styles.status}>{bookingStatusLabel(booking.status, c)}</Text>
            </>
          ) : null}
        </View>

        {cancelled ? (
          <Text style={type.body}>{f.qrCancelledHint}</Text>
        ) : (
          <>
            <View style={styles.qrFrame}>
              <QRCode value={pass.qrData} size={220} color="#000000" backgroundColor="#FFFFFF" />
            </View>
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
