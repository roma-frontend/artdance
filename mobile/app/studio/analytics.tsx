import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { ApiError } from '@/lib/api-client';
import { price } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { getInstructorAnalytics, type InstructorAnalytics } from '@/lib/studio-insights';
import { colors, radius, space, type } from '@/theme';

/** Показатели инструктора за 30 дней. Без пакета с аналитикой сервер отвечает 403. */
export default function StudioAnalyticsScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const a = c.analytics;
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<InstructorAnalytics | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notIncluded, setNotIncluded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getInstructorAnalytics();
      setData(result.analytics);
      setNotIncluded(false);
      setFailed(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setNotIncluded(true);
      else setFailed(serverMessageOf(error) ?? c.errors.generic.description);
    } finally {
      setLoaded(true);
    }
  }, [c.errors.generic.description]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const percent = (value: number | null) => (value === null ? a.none : `${Math.round(value * 100)}%`);

  const cards = data
    ? [
        { key: 'completed', value: String(data.completed) },
        { key: 'revenue', value: price(data.revenue, locale) },
        { key: 'averageCheck', value: data.averageCheck === null ? a.none : price(data.averageCheck, locale) },
        { key: 'attendance', value: percent(data.attendanceRate) },
        { key: 'cancelled', value: String(data.cancelled) },
        { key: 'noShows', value: String(data.noShows) },
        { key: 'unmarked', value: String(data.unmarked) },
        { key: 'uniqueClients', value: String(data.uniqueClients) },
        { key: 'returningClients', value: String(data.returningClients) },
        { key: 'rating', value: data.rating.average === null ? a.none : data.rating.average.toFixed(1) },
      ]
    : [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {a.title}
        </Text>
      </Animated.View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : notIncluded ? (
        <EmptyState icon="lock-closed-outline" title={a.notIncluded} />
      ) : failed !== null || data === null ? (
        <EmptyState icon="alert-circle-outline" title={failed ?? c.errors.generic.description} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        >
          <Text style={type.bodySm}>{a.intro.replace('{days}', String(data.windowDays))}</Text>

          <View style={styles.grid}>
            {cards.map((card, index) => (
              <Animated.View
                key={card.key}
                entering={FadeInDown.delay(index * 40).duration(420).easing(EASE_OUT)}
                style={styles.card}
              >
                <Text style={type.caption}>{a.cards[card.key as keyof typeof a.cards]}</Text>
                <Text style={type.h3}>{card.value}</Text>
              </Animated.View>
            ))}
          </View>

          <Text style={type.bodySm}>{a.ratingNote.replace('{count}', String(data.rating.count))}</Text>
          {data.completed === 0 && data.revenue === 0 ? <Text style={type.bodySm}>{a.none}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  title: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { width: '47%', padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 6 },
});
