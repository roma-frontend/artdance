import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { bookingStatusLabel, canPayBooking, listMyBookings, payBooking, type ClientBooking } from '@/lib/bookings';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { openPaymentUrl } from '@/lib/payment-url';
import { serverMessageOf } from '@/lib/server-message';
import { useAppActive } from '@/lib/use-app-active';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

export default function MyBookingsScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<ClientBooking[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBookings(await listMyBookings());
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useAppActive(load);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function onPay(bookingId: string) {
    if (payingId) return;
    setPayingId(bookingId);
    try {
      const { redirectUrl } = await payBooking(bookingId, 'CARD');
      if (!(await openPaymentUrl(redirectUrl))) Alert.alert(t.bookPayFailed);
    } catch (error) {
      Alert.alert(serverMessageOf(error) ?? t.bookPayFailed);
    } finally {
      setPayingId(null);
    }
  }

  if (bookings === null && failed === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.catalogBack}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.account.bookings.title}</Text>
      </Animated.View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={bookings ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        ListEmptyComponent={
          failed !== null ? (
            <EmptyState icon="alert-circle-outline" title={failed} />
          ) : (
            <EmptyState icon="calendar-outline" title={c.account.bookings.empty} actionLabel={c.account.bookings.emptyCta} onAction={() => router.replace('/(tabs)/classes')} />
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={enterItem(index)} layout={LinearTransition.springify().damping(18)}>
            <PressableScale
              onPress={() => router.push({ pathname: '/booking/[id]/pass', params: { id: item.id } })}
              accessibilityRole="button"
              style={styles.card}
            >
              <Text style={type.h3} numberOfLines={1}>
                {item.classTitle ?? item.reference}
              </Text>
              {item.instructorName ? <Text style={type.bodySm}>{item.instructorName}</Text> : null}
              <Text style={type.bodySm}>
                {dateLabel(item.startsAt, locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
              <View style={styles.footer}>
                <Text style={styles.status}>{bookingStatusLabel(item.status, c)}</Text>
                <Text style={type.label}>{price(item.totalPrice, locale)}</Text>
              </View>
              {canPayBooking(item) ? (
                <PressableScale onPress={() => onPay(item.id)} disabled={payingId !== null} accessibilityRole="button" style={styles.payButton}>
                  <Text style={styles.payText}>{t.payBookingCta}</Text>
                </PressableScale>
              ) : null}
              <View style={styles.openRow}>
                <Ionicons name="qr-code-outline" size={14} color={colors.metal} />
                <Text style={styles.openText}>{c.footer.passTitle}</Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  status: { fontSize: 12, fontWeight: '700', color: colors.metal },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  openText: { fontSize: 12, fontWeight: '700', color: colors.metal },
  payButton: { alignSelf: 'flex-start', marginTop: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.metal },
  payText: { fontSize: 13, fontWeight: '700', color: colors.text },
});
