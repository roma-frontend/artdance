import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getCurrentUser, type User } from '@/lib/auth';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { EASE_OUT, enterItem } from '@/lib/motion';
import { getVenueDashboard, type VenueDashboardSnapshot } from '@/lib/partner-dashboards';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

/**
 * Кабинет владельца площадки. Зеркалит веб `/venue`: площадки, залы, брони и
 * ближайшие занятия приходят из того же серверного источника.
 */
export default function VenueDashboardScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const t = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<VenueDashboardSnapshot | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .catch(() => null)
      .then((next) => {
        if (alive) setUser(next);
      });
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await getVenueDashboard();
      setSnapshot(next);
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, [t.catalogError]);

  useFocusEffect(
    useCallback(() => {
      if (user?.role === 'VENUE_OWNER') void load();
    }, [load, user?.role]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (user === undefined || (user?.role === 'VENUE_OWNER' && snapshot === null && failed === null)) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  const allowed = user?.role === 'VENUE_OWNER';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {c.footer.venueDashboardTitle}
        </Text>
      </Animated.View>

      {!allowed ? (
        <EmptyState icon="lock-closed-outline" title={c.cabinet.notForRole} />
      ) : failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} actionLabel={c.common.actions.retry} onAction={() => void refresh()} />
      ) : snapshot?.venues.length === 0 ? (
        <EmptyState icon="storefront-outline" title={c.footer.venueDashboardEmpty} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentBright} />}
        >
          <Text style={type.bodySm}>{c.footer.venueDashboardHint}</Text>

          {snapshot?.venues.map((venue, index) => {
            const venueBookings = snapshot.bookings.filter((booking) => booking.venueId === venue.id);
            const venueSessions = snapshot.sessions.filter((session) => session.venue.id === venue.id);
            const roomName = (roomId: string | null) => venue.rooms.find((room) => room.id === roomId)?.name;
            const subjectLabel = (subject: string) => (c.admin.enums.bookingSubject as Record<string, string>)[subject] ?? subject;

            return (
              <Animated.View key={venue.id} entering={enterItem(index)} style={styles.section}>
                <Text style={type.h2}>{venue.name}</Text>
                <Text style={type.bodySm}>{venue.district}</Text>

                <Text style={type.h3}>{c.footer.venueDashboardRooms}</Text>
                {venue.rooms.length === 0 ? (
                  <Text style={type.bodySm}>{c.footer.venueDashboardNoRooms}</Text>
                ) : (
                  venue.rooms.map((room) => (
                    <View key={room.id} style={[styles.card, room.isActive === false && styles.inactive]}>
                      <View style={styles.rowBetween}>
                        <Text style={type.h3}>{room.name}</Text>
                        {room.isActive === false ? <Text style={styles.inactiveText}>{c.footer.venueDashboardRoomInactive}</Text> : null}
                      </View>
                      {room.capacity !== undefined ? <Text style={type.bodySm}>{c.footer.venueDashboardCapacity.replace('{count}', String(room.capacity))}</Text> : null}
                      {room.pricePerHour !== undefined ? <Text style={styles.price}>{price(room.pricePerHour, locale)} / {c.common.labels.perHour}</Text> : null}
                    </View>
                  ))
                )}

                <Text style={type.h3}>{c.footer.venueDashboardUpcoming}</Text>
                {venueBookings.length === 0 ? (
                  <Text style={type.bodySm}>{c.footer.venueDashboardNoBookings}</Text>
                ) : (
                  venueBookings.map((booking) => (
                    <View key={booking.id} style={styles.bookingRow}>
                      <View style={styles.bookingText}>
                        <Text style={type.bodySm}>
                          {subjectLabel(booking.subject)}
                          {booking.room ? ` · ${booking.room.name}` : ''}
                        </Text>
                        <Text style={type.caption}>{booking.reference}</Text>
                      </View>
                      <Text style={[type.caption, styles.time]}>
                        {dateLabel(booking.startsAt, locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {dateLabel(booking.endsAt, locale, { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))
                )}

                <Text style={type.h3}>{c.footer.venueDashboardSessions}</Text>
                <Text style={type.caption}>{c.footer.venueDashboardSessionsHint}</Text>
                {venueSessions.length === 0 ? (
                  <Text style={type.bodySm}>{c.footer.venueDashboardNoSessions}</Text>
                ) : (
                  venueSessions.map((session) => (
                    <PressableScale
                      key={session.id}
                      onPress={() => router.push({ pathname: './room-assignment', params: { sessionId: session.id } })}
                      accessibilityRole="button"
                      style={styles.sessionRow}
                    >
                      <View style={styles.bookingText}>
                        <Text style={type.bodySm}>{session.title}</Text>
                        <Text style={type.caption}>
                          {dateLabel(session.startsAt, locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {dateLabel(session.endsAt, locale, { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={styles.roomText}>{roomName(session.roomId) ?? c.footer.venueDashboardNoRoom}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                    </PressableScale>
                  ))
                )}
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  title: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.lg },
  section: { gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  inactive: { opacity: 0.55 },
  inactiveText: { ...type.caption, color: colors.text3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  price: { ...type.caption, color: colors.metal },
  bookingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  bookingText: { flex: 1, gap: 2 },
  time: { textAlign: 'right' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)' },
  roomText: { ...type.caption, color: colors.metal },
});
