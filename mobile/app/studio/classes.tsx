import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getCurrentUser, type User } from '@/lib/auth';
import { dateLabel } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { EASE_OUT, enterItem } from '@/lib/motion';
import { getStudioClasses, type StudioClassesSnapshot } from '@/lib/partner-dashboards';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

export default function StudioClassesScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const t = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [snapshot, setSnapshot] = useCachedState<StudioClassesSnapshot>('studio.classes', 'user');
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
      const next = await getStudioClasses();
      setSnapshot(next);
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, [t.catalogError]);

  useFocusEffect(
    useCallback(() => {
      if (user?.role === 'INSTRUCTOR') void load();
    }, [load, user?.role]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (user === undefined || (user?.role === 'INSTRUCTOR' && snapshot === null && failed === null)) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  const allowed = user?.role === 'INSTRUCTOR';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack('/studio')} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {c.studio.classes.title}
        </Text>
      </Animated.View>

      {!allowed ? (
        <EmptyState icon="lock-closed-outline" title={c.cabinet.notForRole} />
      ) : failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} actionLabel={c.common.actions.retry} onAction={() => void load()} />
      ) : (
        <FlatList
          data={snapshot?.sessions ?? []}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentBright} />}
          ListHeaderComponent={<Text style={type.bodySm}>{c.studio.classes.subtitle}</Text>}
          ListEmptyComponent={<EmptyState icon="school-outline" title={c.studio.classes.empty} />}
          renderItem={({ item, index }) => {
            const selectedRoom = snapshot?.rooms.find((room) => room.id === item.roomId)?.name;
            return (
              <Animated.View entering={enterItem(index)} layout={LinearTransition.springify().damping(18)}>
                <PressableScale
                  onPress={() => router.push({ pathname: '../venue/room-assignment', params: { sessionId: item.id } })}
                  accessibilityRole="button"
                  style={styles.card}
                >
                  <Text style={type.h3} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={type.bodySm}>{item.venue.name}</Text>
                  <Text style={type.bodySm}>
                    {dateLabel(item.startsAt, locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {dateLabel(item.endsAt, locale, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <View style={styles.roomRow}>
                    <Ionicons name="grid-outline" size={16} color={colors.metal} />
                    <Text style={styles.roomText}>{selectedRoom ?? c.footer.venueDashboardNoRoom}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.text3} />
                  </View>
                </PressableScale>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  title: { flex: 1 },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 4 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  roomText: { ...type.bodySm, color: colors.metal, flex: 1 },
});
