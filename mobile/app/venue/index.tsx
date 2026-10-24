import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { getCurrentUser, type User } from '@/lib/auth';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT, enterItem } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/**
 * Кабинет владельца площадки. Зеркалит веб `/venue`: пока заглушка со статусом «скоро»,
 * управление комнатами откроется после запуска.
 */
export default function VenueDashboardScreen() {
  const c = catalogFor(deviceLocale(undefined));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null | undefined>(undefined);

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

  if (user === undefined) {
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
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {c.footer.venueDashboardTitle}
        </Text>
      </Animated.View>

      {!allowed ? (
        <EmptyState icon="lock-closed-outline" title={c.cabinet.notForRole} />
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={type.bodySm}>{`${c.common.states.comingSoon} — ${c.footer.districtHint}`}</Text>

          <Animated.View entering={enterItem(0)}>
            <View style={[styles.card, styles.disabled]} accessibilityState={{ disabled: true }}>
              <Ionicons name="grid-outline" size={22} color={colors.text3} />
              <Text style={[type.h3, styles.disabledText]}>{c.footer.venueDashboardRooms}</Text>
              <Text style={type.caption}>{c.common.states.comingSoon}</Text>
            </View>
          </Animated.View>
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
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  disabled: { opacity: 0.5 },
  disabledText: { color: colors.text3 },
});
