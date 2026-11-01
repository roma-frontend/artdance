import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { deleteSavedSearch, listSavedSearches, type SavedSearch } from '@/lib/saved-searches';
import { colors, radius, space, type } from '@/theme';

/** Сохранённые поиски. Открывают экран поиска с теми же запросом и разделом. */
export default function SavedSearchesScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const s = c.savedSearches;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listSavedSearches();
      setItems(data.items);
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? c.errors.generic.description);
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

  async function remove(item: SavedSearch) {
    setBusyId(item.id);
    try {
      await deleteSavedSearch(item.id);
      setItems((list) => list.filter((row) => row.id !== item.id));
    } catch (error) {
      setFailed(serverMessageOf(error) ?? c.errors.generic.description);
    } finally {
      setBusyId(null);
    }
  }

  const scopeLabel = (scope: string): string => {
    const labels: Record<string, string> = {
      all: c.search.scopeAll,
      classes: c.search.scopeClasses,
      instructors: c.search.scopeInstructors,
      studios: c.search.scopeStudios,
      products: c.search.scopeProducts,
      events: c.search.scopeEvents,
    };
    return labels[scope] ?? scope;
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {s.title}
        </Text>
      </Animated.View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : items.length === 0 ? (
        <EmptyState icon="bookmark-outline" title={s.empty} body={s.emptyHint} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        >
          {items.map((item, index) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(index * 50).duration(420).easing(EASE_OUT)} style={styles.card}>
              <Text style={type.h3}>{item.query}</Text>
              <Text style={type.bodySm}>{scopeLabel(item.scope)}</Text>
              <View style={styles.row}>
                <Button
                  label={s.open}
                  onPress={() => router.push(`/search?q=${encodeURIComponent(item.query)}&scope=${item.scope}`)}
                  disabled={busyId === item.id}
                />
                <Button label={s.remove} variant="ghost" onPress={() => void remove(item)} busy={busyId === item.id} disabled={busyId === item.id} />
              </View>
            </Animated.View>
          ))}
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
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
});
