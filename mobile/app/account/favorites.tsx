import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { listMyFavorites, type FavoriteItem, type FavoriteKind } from '@/lib/favorites';
import { colors, radius, space, type } from '@/theme';

export default function MyFavoritesScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<FavoriteItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listMyFavorites());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (items === null && !failed) {
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
        <Text style={type.h2}>{c.favorites.title}</Text>
      </View>

      <FlatList
        data={items ?? []}
        keyExtractor={(item) => `${item.kind}:${item.slug}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        ListEmptyComponent={
          failed ? (
            <EmptyState icon="alert-circle-outline" title={t.catalogError} />
          ) : (
            <EmptyState icon="heart-outline" title={c.favorites.empty} body={c.favorites.emptyHint} />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Ionicons name={KIND_ICON[item.kind]} size={18} color={colors.accentBright} />
            <View style={styles.body}>
              <Text style={type.label} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.kind}>{kindLabel(item.kind, c)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const KIND_ICON: Record<FavoriteKind, 'school-outline' | 'person-outline' | 'business-outline' | 'bag-outline'> = {
  class: 'school-outline',
  instructor: 'person-outline',
  venue: 'business-outline',
  product: 'bag-outline',
};

function kindLabel(kind: FavoriteKind, c: ReturnType<typeof catalogFor>): string {
  const nav = c.nav as Record<string, string>;
  const keys: Record<FavoriteKind, string> = { class: 'classes', instructor: 'instructors', venue: 'studios', product: 'shop' };
  return nav[keys[kind]] ?? kind;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245,241,234,0.06)',
  },
  body: { flex: 1, gap: 2 },
  kind: { fontSize: 12, color: colors.metal },
});
