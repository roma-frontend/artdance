import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { GestureHint } from '@/components/gesture-hint';
import { ListSkeleton } from '@/components/skeleton';
import { CollapsingHeader } from '@/components/ui/collapsing-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FadeImage } from '@/components/ui/fade-image';
import { GlassButton } from '@/components/ui/glass-button';
import { MediaCard } from '@/components/ui/media-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/types';
import { CatalogError, listCatalog, type CatalogItem, type Section } from '@/lib/catalog';
import { cardView } from '@/lib/catalog-view';
import { plural } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { useScrollChrome } from '@/lib/use-scroll-chrome';
import { colors, fonts, gradients, radius, space, type } from '@/theme';

const sections: readonly Section[] = ['classes', 'instructors', 'studios', 'events', 'shop'];

/** Подсказка жеста над списком; для армянского пока используется английский текст. */
const HINTS: Record<string, string> = {
  ru: 'Нажмите на карточку, чтобы открыть подробности',
  en: 'Tap a card to see details',
};

const COUNT_KEYS: Partial<Record<Section, 'classes' | 'instructors' | 'studios'>> = {
  classes: 'classes',
  instructors: 'instructors',
  studios: 'studios',
};

export default function CatalogListScreen({ sectionProp }: { sectionProp?: string }) {
  const params = useLocalSearchParams<{ section: string }>();
  const section = sectionProp ?? params.section;
  const locale = deviceLocale(undefined);
  const m = messagesFor(locale);
  const t = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cellWidth = (width - space.xl * 2 - space.md) / 2;
  const { scrollY, onScroll } = useScrollChrome();
  const valid = sections.find((s) => s === section);
  const pushed = !sectionProp;

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    setLoading(true);
    setError(null);
    listCatalog(valid, { page: String(page), pageSize: '20' })
      .then((result) => {
        if (!alive) return;
        setItems((prev) => (page === 1 ? result.items : [...prev, ...result.items]));
        setPageCount(result.pageCount);
        setTotal(result.total);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof CatalogError ? err.code : 'network');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      alive = false;
    };
  }, [valid, page, reloadKey]);

  const reload = useCallback(() => {
    setPage(1);
    setReloadKey((k) => k + 1);
  }, []);

  const largeTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 70], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [-120, 0], [24, 0], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-120, 0], [1.08, 1], Extrapolation.CLAMP) },
    ],
  }));

  if (!valid) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 60 }]}>
        <EmptyState icon="compass-outline" title={m.catalogNotFound} actionLabel={m.catalogBack} onAction={() => router.back()} />
      </View>
    );
  }

  const title = t.catalog[valid].title;
  const countKey = COUNT_KEYS[valid];
  const open = (slug: string) => router.push({ pathname: '/catalog/[section]/[slug]', params: { section: valid, slug } });
  const backButton = pushed ? <GlassButton icon="chevron-back" label={m.catalogBack} onPress={() => router.back()} /> : null;

  const header = (
    <View>
      <Animated.View style={[styles.titleBlock, { paddingTop: insets.top + (pushed ? 64 : 20) }, largeTitle]}>
        <BrandLogo width={104} />
        <Text style={type.h1}>{title}</Text>
        <Text style={type.bodySm}>{t.catalog[valid].subtitle}</Text>
        {total !== null && countKey ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{plural(t.common.counts[countKey], total, locale)}</Text>
          </View>
        ) : null}
        {items[0] ? <GestureHint text={HINTS[locale] ?? HINTS.en} /> : null}
      </Animated.View>
      {items[0] ? <Featured item={items[0]} section={valid} t={t} locale={locale} onPress={() => open(items[0].slug)} /> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <CollapsingHeader scrollY={scrollY} title={title} threshold={70} left={backButton} />

      <Animated.FlatList
        data={items.slice(1)}
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
              reload();
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
                badge={view.badge}
                price={view.price}
                rating={view.rating}
                onPress={() => open(item.slug)}
              />
            </Animated.View>
          );
        }}
        onEndReached={() => {
          if (!loading && !error && page < pageCount) setPage((p) => p + 1);
        }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          loading && items.length > 0 ? <ActivityIndicator color={colors.text2} style={styles.loader} /> : undefined
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.padded}>
              <ListSkeleton />
            </View>
          ) : error ? (
            <EmptyState icon="cloud-offline-outline" title={m.catalogError} actionLabel={t.common.actions.retry} onAction={reload} />
          ) : items.length === 0 ? (
            <EmptyState icon="sparkles-outline" title={t.catalog.empty.title} body={m.catalogEmpty} />
          ) : undefined
        }
      />
    </View>
  );
}

function Featured({
  item,
  section,
  t,
  locale,
  onPress,
}: {
  item: CatalogItem;
  section: Section;
  t: Messages;
  locale: Locale;
  onPress: () => void;
}) {
  const view = cardView(item, t, locale);
  return (
    <Animated.View entering={FadeInDown.duration(600)} style={styles.padded}>
      <PressableScale onPress={onPress} pressedScale={0.97} style={styles.hero} accessibilityLabel={view.title}>
        <LinearGradient colors={['#3A1520', '#140C0F']} style={StyleSheet.absoluteFill} />
        {view.uri ? <FadeImage uri={view.uri} /> : null}
        <LinearGradient colors={gradients.heroShade} locations={[0.35, 0.65, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTop}>
          {view.badge ? (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{view.badge}</Text>
            </View>
          ) : (
            <View />
          )}
          {view.rating ? (
            <View style={styles.heroRating}>
              <Ionicons name="star" size={12} color={colors.metal} />
              <Text style={styles.heroRatingText}>{view.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.heroKicker}>{t.nav[section]}</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {view.title}
          </Text>
          <View style={styles.heroFooter}>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {view.meta}
            </Text>
            {view.price ? (
              <View style={styles.heroPrice}>
                <Text style={styles.heroPriceText}>{view.price}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 140 },
  padded: { paddingHorizontal: space.xl },
  titleBlock: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 6 },
  countPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  countText: { fontSize: 12, fontWeight: '700', color: colors.text2 },
  gridRow: { gap: space.md, paddingHorizontal: space.xl },
  cell: { flex: 1, marginBottom: space.xl },
  loader: { marginVertical: space.lg },
  hero: {
    height: 340,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: space.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  heroTop: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  heroBadge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.accent },
  heroBadgeText: { fontSize: 11, fontWeight: '800', color: colors.white, letterSpacing: 0.6, textTransform: 'uppercase' },
  heroRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  heroRatingText: { fontSize: 12, fontWeight: '700', color: colors.text },
  heroBody: { position: 'absolute', left: 18, right: 18, bottom: 18, gap: 6 },
  heroKicker: { ...type.eyebrow },
  heroTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 33, color: colors.text },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroMeta: { flex: 1, fontSize: 13, color: colors.text2 },
  heroPrice: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: 'rgba(245,241,234,0.95)' },
  heroPriceText: { fontSize: 13, fontWeight: '800', color: colors.bg },
});
