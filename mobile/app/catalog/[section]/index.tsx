import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter, useScrollToTop } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, type AlertButton, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

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
import { plural, webUrl } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { goBack } from '@/lib/navigation';
import { useEntitlements } from '@/lib/entitlements';
import { FAVORITE_KIND, FavoritesError, listMyFavorites, toggleMyFavorite, type FavoriteKind } from '@/lib/favorites';
import { serverMessageOf } from '@/lib/server-message';
import { useScrollChrome } from '@/lib/use-scroll-chrome';
import { colors, fonts, gradients, radius, space, type } from '@/theme';

const sections: readonly Section[] = ['classes', 'instructors', 'studios', 'events', 'shop'];

/** Подсказка жеста над списком. */
const HINTS: Record<string, string> = {
  hy: 'Հպեք՝ բացելու համար, պահեք՝ արագ գործողությունների համար',
  ru: 'Нажмите — открыть, удержите — быстрые действия',
  en: 'Tap to open, hold for quick actions',
};

const COUNT_KEYS: Partial<Record<Section, 'classes' | 'instructors' | 'studios'>> = {
  classes: 'classes',
  instructors: 'instructors',
  studios: 'studios',
};

/** Раздел событий открывается только при включённом модуле; иначе уводим на главную. */
export default function CatalogListScreen({ sectionProp }: { sectionProp?: string }) {
  const params = useLocalSearchParams<{ section: string }>();
  const entitlements = useEntitlements();
  const section = sectionProp ?? params.section;
  if (section === 'events') {
    if (!entitlements) return null;
    if (entitlements.events !== true) return <Redirect href="/" />;
  }
  return <CatalogListBody sectionProp={sectionProp} />;
}

function CatalogListBody({ sectionProp }: { sectionProp?: string }) {
  const params = useLocalSearchParams<{ section: string; style?: string; styleName?: string }>();
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
  // Фильтр по направлению приходит из хаба `/styles/[slug]`: слаг уходит на сервер, название — только в чип.
  const styleSlug = params.style?.trim() || null;
  const styleName = params.styleName?.trim() || null;

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  /** К какому запросу относятся показанные карточки: старые результаты не выдаются за новые. */
  const itemsKey = useRef<string | null>(null);
  const listRef = useRef<FlatList<CatalogItem>>(null);
  useScrollToTop(listRef);

  // Запрос уходит на сервер с задержкой; новый запрос всегда начинается с первой страницы.
  useEffect(() => {
    const handle = setTimeout(() => {
      setTerm(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    const key = `${valid}|${term}|${styleSlug ?? ''}`;
    if (page === 1 && itemsKey.current !== key) setItems([]);
    setLoading(true);
    setError(null);
    listCatalog(valid, {
      page: String(page),
      pageSize: '20',
      ...(term ? { q: term } : {}),
      ...(styleSlug ? { style: styleSlug } : {}),
    })
      .then((result) => {
        if (!alive) return;
        itemsKey.current = key;
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
  }, [valid, page, term, styleSlug, reloadKey]);

  const reload = useCallback(() => {
    setPage(1);
    setReloadKey((k) => k + 1);
  }, []);
  /** Повтор страницы, которая не загрузилась, без сброса уже показанных. */
  const retryPage = useCallback(() => setReloadKey((k) => k + 1), []);

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
        <EmptyState icon="compass-outline" title={m.catalogNotFound} actionLabel={m.catalogBack} onAction={() => goBack()} />
      </View>
    );
  }

  const title = t.catalog[valid].title;
  const countKey = COUNT_KEYS[valid];
  const open = (slug: string) => router.push({ pathname: '/catalog/[section]/[slug]', params: { section: valid, slug } });

  const toggleFavorite = async (kind: FavoriteKind, slug: string) => {
    try {
      await toggleMyFavorite(kind, slug);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch (err: unknown) {
      const signedOut = err instanceof FavoritesError && err.status === 401;
      Alert.alert(signedOut ? t.favorites.signInRequired : (serverMessageOf(err) ?? m.catalogError));
    }
  };

  // Долгое нажатие на карточку: сохранить, поделиться или открыть, не переходя сразу в карточку.
  const quickActions = async (item: CatalogItem) => {
    const kind = FAVORITE_KIND[valid];
    const view = cardView(item, t, locale);
    const url = webUrl(locale, `/${valid}/${item.slug}`);
    const saved = kind
      ? await listMyFavorites()
          .then((list) => list.some((f) => f.kind === kind && f.slug === item.slug))
          .catch(() => false)
      : false;
    const buttons: AlertButton[] = [];
    if (kind) {
      buttons.push({
        text: saved ? t.common.actions.removeFromFavorites : t.common.actions.addToFavorites,
        onPress: () => void toggleFavorite(kind, item.slug),
      });
    }
    buttons.push({
      text: t.common.actions.share,
      onPress: () => void Share.share({ message: `${view.title}\n${url}`, url }).catch(() => undefined),
    });
    buttons.push({ text: t.common.actions.viewDetails, onPress: () => open(item.slug) });
    Haptics.selectionAsync().catch(() => undefined);
    Alert.alert(view.title, undefined, buttons);
  };
  const backButton = pushed ? <GlassButton icon="chevron-back" label={m.catalogBack} onPress={() => goBack()} /> : null;

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
        {styleName ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{styleName}</Text>
          </View>
        ) : null}
        {items[0] ? <GestureHint text={HINTS[locale] ?? HINTS.en} /> : null}
      </Animated.View>
      {valid === 'classes' ? (
        <View style={styles.pillRow}>
          <PressableScale onPress={() => router.push({ pathname: '/schedule' })} style={styles.schedulePill} accessibilityLabel={t.nav.schedule}>
            <Ionicons name="calendar-outline" size={16} color={colors.text} />
            <Text style={styles.scheduleText}>{t.nav.schedule}</Text>
          </PressableScale>
          <PressableScale onPress={() => router.push({ pathname: '/styles' })} style={styles.schedulePill} accessibilityLabel={t.nav.styles}>
            <Ionicons name="color-palette-outline" size={16} color={colors.text} />
            <Text style={styles.scheduleText}>{t.nav.styles}</Text>
          </PressableScale>
        </View>
      ) : null}
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.text3} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t.search.placeholder}
            placeholderTextColor={colors.text3}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            selectionColor={colors.accentBright}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={t.common.actions.clear}>
              <Ionicons name="close-circle" size={18} color={colors.text3} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {items[0] ? (
        <Featured
          item={items[0]}
          section={valid}
          t={t}
          locale={locale}
          onPress={() => open(items[0].slug)}
          onLongPress={() => void quickActions(items[0])}
        />
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <CollapsingHeader scrollY={scrollY} title={title} threshold={70} left={backButton} />

      <Animated.FlatList
        ref={listRef}
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
                onLongPress={() => void quickActions(item)}
              />
            </Animated.View>
          );
        }}
        onEndReached={() => {
          if (!loading && !error && page < pageCount) setPage((p) => p + 1);
        }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          loading && items.length > 0 ? (
            <ActivityIndicator color={colors.text2} style={styles.loader} />
          ) : error && items.length > 0 ? (
            <EmptyState icon="cloud-offline-outline" title={m.catalogError} actionLabel={t.common.actions.retry} onAction={retryPage} />
          ) : undefined
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.padded}>
              <ListSkeleton />
            </View>
          ) : error && items.length === 0 ? (
            <EmptyState icon="cloud-offline-outline" title={m.catalogError} actionLabel={t.common.actions.retry} onAction={reload} />
          ) : items.length === 0 ? (
            term ? (
              <EmptyState icon="search-outline" title={t.search.noResults.replace('{query}', term)} body={t.search.noResultsHint} />
            ) : (
              <EmptyState icon="sparkles-outline" title={t.catalog.empty.title} body={m.catalogEmpty} />
            )
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
  onLongPress,
}: {
  item: CatalogItem;
  section: Section;
  t: Messages;
  locale: Locale;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const view = cardView(item, t, locale);
  return (
    <Animated.View entering={FadeInDown.duration(600)} style={styles.padded}>
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        pressedScale={0.97}
        style={styles.hero}
        accessibilityLabel={view.title}
      >
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
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.xl, marginBottom: space.lg },
  schedulePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  scheduleText: { fontSize: 13, fontWeight: '700', color: colors.text },
  searchWrap: { paddingHorizontal: space.xl, marginBottom: space.xl },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
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
