import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getCurrentUser, type User } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT, enterItem } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/**
 * Кабинет инструктора-студии. Основные доступные разделы зеркалят веб `/studio`.
 * Заявки больше не показываются: в текущем веб-продукте для них нет источника
 * данных, поэтому мобильный интерфейс не обещает несуществующую функцию.
 */
export default function StudioDashboardScreen() {
  const c = catalogFor(deviceLocale(undefined));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const eventsOn = useEntitlements()?.events === true;

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

  const allowed = user?.role === 'INSTRUCTOR';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {c.footer.studioDashboardTitle}
        </Text>
      </Animated.View>

      {!allowed ? (
        <EmptyState icon="lock-closed-outline" title={c.cabinet.notForRole} />
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enterItem(0)}>
            <PressableScale onPress={() => router.push('/studio/availability')} accessibilityRole="button">
              <View style={styles.card}>
                <Ionicons name="calendar-outline" size={22} color={colors.accentBright} />
                <Text style={type.h3}>{c.footer.studioDashboardAvailability}</Text>
              </View>
            </PressableScale>
          </Animated.View>

          <Animated.View entering={enterItem(1)}>
            <PressableScale onPress={() => router.push('./classes')} accessibilityRole="button">
              <View style={styles.card}>
                <Ionicons name="school-outline" size={22} color={colors.accentBright} />
                <Text style={type.h3}>{c.footer.studioDashboardClasses}</Text>
              </View>
            </PressableScale>
          </Animated.View>

          {eventsOn ? (
            <Animated.View entering={enterItem(2)}>
              <PressableScale onPress={() => router.push('/studio/check-in')} accessibilityRole="button">
                <View style={styles.card}>
                  <Ionicons name="qr-code-outline" size={22} color={colors.accentBright} />
                  <Text style={type.h3}>{c.footer.studioCheckInTitle}</Text>
                  <Text style={type.bodySm}>{c.footer.studioCheckInHint}</Text>
                </View>
              </PressableScale>
            </Animated.View>
          ) : null}
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
});
