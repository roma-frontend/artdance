import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/skeleton';
import { CollapsingHeader } from '@/components/ui/collapsing-header';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassButton } from '@/components/ui/glass-button';
import { MediaCard } from '@/components/ui/media-card';
import { catalogFor } from '@/i18n/catalog';
import { listCatalog, type CatalogItem } from '@/lib/catalog';
import { cardView } from '@/lib/catalog-view';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { goBack } from '@/lib/navigation';
import { useScrollChrome } from '@/lib/use-scroll-chrome';
import { colors, space, type } from '@/theme';

/** Расписание: те же 20 новых занятий, что и веб-страница `/schedule`. */
export default function ScheduleScreen() {
  const locale = deviceLocale(undefined);
  const m = messagesFor(locale);
  const t = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cellWidth = (width - space.xl * 2 - space.md) / 2;
  const { scrollY, onScroll } = useScrollChrome();

  const [items, setItems] = useCachedState<CatalogItem[]>('content.schedule', 'public');
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    listCatalog('classes', { sort: 'newest', page: '1', pageSize: '20' })
      .then((result) => {
        if (alive) setItems(result.items);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setRefreshing(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const title = t.nav.schedule;
  const open = (slug: string) => router.push({ pathname: '/catalog/[section]/[slug]', params: { section: 'classes', slug } });

  const header = (
    <View style={[styles.titleBlock, { paddingTop: insets.top + 64 }]}>
      <Text style={type.h1}>{title}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <CollapsingHeader
        scrollY={scrollY}
        title={title}
        threshold={70}
        left={<GlassButton icon="chevron-back" label={m.catalogBack} onPress={() => goBack('/classes')} />}
      />

      <Animated.FlatList
        data={items ?? []}
        keyExtractor={(item) => item.slug}
        numColumns={2}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setReloadKey((k) => k + 1);
            }}
            tintColor={colors.text2}
            colors={[colors.accentBright]}
            progressBackgroundColor={colors.surface2}
            progressViewOffset={insets.top + 40}
          />
        }
        renderItem={({ item, index }) => {
          const view = cardView(item, t, locale);
          return (
            <Animated.View entering={FadeInDown.delay((index % 6) * 70).duration(450)} style={[styles.cell, { maxWidth: cellWidth }]}>
              <MediaCard
                uri={view.uri}
                title={view.title}
                meta={view.meta}
                badge={view.badge} badgeTone={view.badgeTone} corner={view.corner}
                price={view.price}
                rating={view.rating}
                onPress={() => open(item.slug)}
              />
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          failed ? (
            <EmptyState icon="cloud-offline-outline" title={m.catalogError} actionLabel={t.common.actions.retry} onAction={() => setReloadKey((k) => k + 1)} />
          ) : items === null ? (
            <View style={styles.padded}>
              <ListSkeleton />
            </View>
          ) : (
            <EmptyState icon="calendar-outline" title={t.catalog.empty.title} body={m.catalogEmpty} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 140 },
  padded: { paddingHorizontal: space.xl },
  titleBlock: { paddingHorizontal: space.xl, paddingBottom: space.xl },
  gridRow: { gap: space.md, paddingHorizontal: space.xl },
  cell: { flex: 1, marginBottom: space.xl },
});
