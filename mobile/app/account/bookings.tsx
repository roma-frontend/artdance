import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { bookingStatusLabel, listMyBookings, type ClientBooking } from '@/lib/bookings';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { serverMessageOf } from '@/lib/server-message';
import { useAppActive } from '@/lib/use-app-active';
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

  const load = useCallback(async () => {
    try {
      setBookings(await listMyBookings());
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAppActive(load);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
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
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.account.bookings.title}</Text>
      </View>

      <FlatList
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
        renderItem={({ item }) => (
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
            <View style={styles.openRow}>
              <Ionicons name="qr-code-outline" size={14} color={colors.metal} />
              <Text style={styles.openText}>{c.footer.passTitle}</Text>
            </View>
          </PressableScale>
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
});
