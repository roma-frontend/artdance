import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FiltersSheet } from '@/components/filters-sheet';
import { PosterRowSkeleton, Skeleton } from '@/components/skeleton';
import { FadeImage } from '@/components/ui/fade-image';
import { MediaCard } from '@/components/ui/media-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented } from '@/components/ui/segmented';
import { catalogFor } from '@/i18n/catalog';
import type { Locale } from '@/i18n/config';
import { getCurrentUser, type User } from '@/lib/auth';
import { listCatalog, mediaUri, type ClassCard, type EventCard, type InstructorCard, type Section } from '@/lib/catalog';
import { cardView } from '@/lib/catalog-view';
import { API_URL } from '@/lib/config';
import { dateLabel, initials, price } from '@/lib/format';
import { deviceLocale, greeting, messagesFor } from '@/lib/i18n';
import { useScrollChrome } from '@/lib/use-scroll-chrome';
import { colors, fonts, gradients, radius, space, springs, type } from '@/theme';

type SearchHit = { id: string; scope: string; title: string; subtitle: string; href: string };
type IconName = ComponentProps<typeof Ionicons>['name'];

/** Настроения из веба (src/config/dance-experience.ts), порядок и стили совпадают. */
const MOODS = [
  { key: 'energy', styles: ['HIP_HOP', 'BREAKING', 'KPOP', 'AFRO', 'JAZZ'] },
  { key: 'flow', styles: ['CONTEMPORARY', 'BALLET', 'STRETCHING', 'HEELS'] },
  { key: 'partner', styles: ['SALSA', 'BACHATA', 'TANGO', 'KIZOMBA', 'WEDDING_DANCE'] },
  { key: 'stage', styles: ['BALLROOM', 'LATIN', 'ARMENIAN_FOLK', 'FLAMENCO'] },
] as const;
type MoodKey = (typeof MOODS)[number]['key'];

const STYLE_KEYS = [
  ['HIP_HOP', 'hipHop'], ['BALLET', 'ballet'], ['SALSA', 'salsa'], ['BACHATA', 'bachata'],
  ['CONTEMPORARY', 'contemporary'], ['HEELS', 'heels'], ['KPOP', 'kpop'], ['LATIN', 'latin'],
  ['TANGO', 'tango'], ['ARMENIAN_FOLK', 'armenianFolk'], ['JAZZ', 'jazz'], ['BREAKING', 'breaking'],
  ['FLAMENCO', 'flamenco'], ['BALLROOM', 'ballroom'], ['AFRO', 'afro'], ['WEDDING_DANCE', 'weddingDance'],
  ['KIDS', 'kids'], ['STRETCHING', 'stretching'], ['KIZOMBA', 'kizomba'],
] as const;

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const SECTIONS: readonly Section[] = ['classes', 'instructors', 'studios', 'events', 'shop'];
const TAB_SECTIONS: Partial<Record<Section, '/classes' | '/events' | '/shop'>> = {
  classes: '/classes',
  events: '/events',
  shop: '/shop',
};
const SCOPE_ICONS: Record<string, IconName> = {
  classes: 'musical-notes',
  instructors: 'person',
  studios: 'business',
  events: 'sparkles',
  shop: 'bag-handle',
  products: 'bag-handle',
};

export default function HomeScreen() {
  const locale: Locale = deviceLocale(undefined);
  const t = catalogFor(locale);
  const m = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { scrollY, onScroll } = useScrollChrome();

  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [events, setEvents] = useState<EventCard[] | null>(null);
  const [instructors, setInstructors] = useState<InstructorCard[] | null>(null);
  const [mood, setMood] = useState<MoodKey>('energy');
  const [moodClasses, setMoodClasses] = useState<ClassCard[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .catch(() => null)
      .then((u) => alive && setUser(u));
    listCatalog('events', { page: '1', pageSize: '5' })
      .then((r) => alive && setEvents(r.items as EventCard[]))
      .catch(() => alive && setEvents([]));
    listCatalog('instructors', { page: '1', pageSize: '12' })
      .then((r) => alive && setInstructors(r.items as InstructorCard[]))
      .catch(() => alive && setInstructors([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const chosen = MOODS.find((x) => x.key === mood);
    if (!chosen) return;
    setMoodClasses(null);
    const styles = styleFilter ? [styleFilter] : chosen.styles;
    const extra: Record<string, string> = levelFilter ? { level: levelFilter } : {};
    Promise.all(styles.map((style) => listCatalog('classes', { style, pageSize: '3', ...extra })))
      .then((results) => alive && setMoodClasses(results.flatMap((r) => r.items as ClassCard[]).slice(0, 8)))
      .catch(() => alive && setMoodClasses([]));
    return () => {
      alive = false;
    };
  }, [mood, styleFilter, levelFilter]);

  const term = query.trim();
  const isSearch = term.length >= MIN_QUERY_LENGTH;

  // Поиск с задержкой и отменой устаревших запросов, как в вебе.
  useEffect(() => {
    if (!isSearch) {
      setHits([]);
      setFailed(false);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      setFailed(false);
      const params = new URLSearchParams({ q: term, locale, scope: 'all' });
      fetch(`${API_URL}/api/search?${params.toString()}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<{ hits: SearchHit[] }>;
        })
        .then((body) => {
          setHits(body.hits);
          setSearching(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setHits([]);
          setFailed(true);
          setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, isSearch, locale]);

  const openSection = (section: Section) => {
    const tab = TAB_SECTIONS[section];
    if (tab) router.navigate(tab);
    else router.push({ pathname: '/catalog/[section]', params: { section } });
  };
  const openDetail = (section: Section, slug: string) =>
    router.push({ pathname: '/catalog/[section]/[slug]', params: { section, slug } });

  const openHit = (hit: SearchHit) => {
    const parts = hit.href.split('?')[0].split('/').filter(Boolean);
    const slug = parts[parts.length - 1];
    const section = SECTIONS.find((s) => s === parts[parts.length - 2]);
    if (section && slug) openDetail(section, slug);
  };

  const filtersActive = (styleFilter ? 1 : 0) + (levelFilter ? 1 : 0);
  const tagline = t.brand.taglineAlt.replace(/\.$/, '');
  const lastSpace = tagline.lastIndexOf(' ');
  const glow = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 260], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [-200, 0, 300], [60, 0, -120], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.glow, glow]} pointerEvents="none">
        <LinearGradient colors={['rgba(139,26,43,0.55)', 'rgba(139,26,43,0.12)', 'rgba(11,8,9,0)']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: 140 }}
      >
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              {greeting(m)}
              {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </Text>
            <Text style={type.hero}>
              {tagline.slice(0, lastSpace + 1)}
              <Text style={styles.heroAccent}>{tagline.slice(lastSpace + 1)}.</Text>
            </Text>
          </View>
          <PressableScale onPress={() => router.navigate('/account')} accessibilityLabel={m.tabAccount} style={styles.avatarRing}>
            <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user?.name ?? 'A D')}</Text>
            </View>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(600)} style={styles.searchRow}>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t.search.heroPlaceholder}
            focused={focused}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            clearLabel={t.common.actions.clear}
          />
          <PressableScale
            style={[styles.filterButton, filtersActive > 0 && styles.filterButtonActive]}
            onPress={() => setFiltersOpen(true)}
            accessibilityLabel={t.catalog.filters.title}
          >
            <Ionicons name="options-outline" size={21} color={colors.text} />
            {filtersActive > 0 ? (
              <Animated.View entering={FadeIn} style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filtersActive}</Text>
              </Animated.View>
            ) : null}
          </PressableScale>
        </Animated.View>

        {isSearch ? (
          <View style={styles.results}>
            {searching ? <ActivityIndicator color={colors.text2} style={styles.loader} /> : null}
            {failed ? <Text style={styles.notice}>{t.search.failed}</Text> : null}
            {!searching && !failed && hits.length === 0 ? (
              <Animated.View entering={FadeIn} style={styles.noResults}>
                <Ionicons name="search" size={28} color={colors.text3} />
                <Text style={type.h3}>{t.search.noResults.replace('{query}', term)}</Text>
                <Text style={type.bodySm}>{t.search.noResultsHint}</Text>
              </Animated.View>
            ) : null}
            {hits.map((hit, index) => (
              <Animated.View key={`${hit.scope}-${hit.id}`} entering={FadeInDown.delay(index * 40).duration(350)}>
                <PressableScale
                  pressedScale={0.98}
                  style={styles.hit}
                  onPress={() => {
                    Keyboard.dismiss();
                    openHit(hit);
                  }}
                >
                  <View style={styles.hitIcon}>
                    <Ionicons name={SCOPE_ICONS[hit.scope] ?? 'search'} size={18} color={colors.accentBright} />
                  </View>
                  <View style={styles.hitText}>
                    <Text style={type.title} numberOfLines={1}>
                      {hit.title}
                    </Text>
                    {hit.subtitle ? (
                      <Text style={type.caption} numberOfLines={1}>
                        {hit.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.text3} />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        ) : (
          <Animated.View exiting={FadeOut.duration(150)}>
            <Spotlight
              events={events}
              width={width}
              eyebrow={t.home.eventSpotlight.eyebrow}
              locale={locale}
              freeLabel={t.common.labels.free}
              onOpen={(slug) => openDetail('events', slug)}
            />

            <View style={styles.block}>
              <SectionHeader eyebrow={m.forYourMood} title={t.home.finder.intentLabel} />
              <Segmented
                scrollable
                options={MOODS.map((x) => ({ key: x.key, label: t.home.finder.intents[x.key].title }))}
                value={mood}
                onChange={setMood}
              />
              <Animated.Text key={mood} entering={FadeIn.duration(300)} style={styles.moodBody}>
                {t.home.finder.intents[mood].body}
              </Animated.Text>
              {moodClasses === null ? (
                <PosterRowSkeleton />
              ) : moodClasses.length === 0 ? (
                <Text style={styles.notice}>{t.home.finder.empty}</Text>
              ) : (
                <FlatList
                  horizontal
                  data={moodClasses}
                  keyExtractor={(item) => item.slug}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.row}
                  decelerationRate="fast"
                  snapToInterval={160 + space.md}
                  renderItem={({ item, index }) => {
                    const view = cardView(item, t, locale);
                    return (
                      <Animated.View entering={FadeInDown.delay(index * 60).duration(450)}>
                        <MediaCard
                          width={160}
                          uri={view.uri}
                          title={view.title}
                          meta={view.meta}
                          badge={view.badge}
                          price={view.price}
                          onPress={() => openDetail('classes', item.slug)}
                        />
                      </Animated.View>
                    );
                  }}
                />
              )}
            </View>

            <View style={styles.block}>
              <SectionHeader
                eyebrow={t.home.instructors.eyebrow}
                title={t.nav.instructors}
                actionLabel={t.common.actions.viewAll}
                onAction={() => openSection('instructors')}
              />
              <Stories items={instructors} onOpen={(slug) => openDetail('instructors', slug)} />
            </View>

            <View style={styles.block}>
              <SectionHeader eyebrow={t.home.discover.eyebrow} title={t.home.discover.title} />
              <Bento t={t} onOpen={openSection} />
            </View>

            <Animated.View entering={FadeInDown.delay(200).duration(700)} style={styles.editorial}>
              <LinearGradient
                colors={['#5A0F1C', '#2A0A12', '#140C0F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={type.eyebrow}>{t.brand.madeIn}</Text>
              <Text style={styles.editorialTitle}>
                {t.home.editorial.titleLine1}
                {'\n'}
                {t.home.editorial.titleLine2} <Text style={styles.heroAccent}>{t.home.editorial.titleAccent}</Text>
              </Text>
              <Text style={type.body}>{t.home.editorial.subtitle}</Text>
              <PressableScale style={styles.editorialCta} onPress={() => openSection('classes')}>
                <Text style={styles.editorialCtaText}>{t.home.editorial.cta}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.bg} />
              </PressableScale>
            </Animated.View>
          </Animated.View>
        )}
      </Animated.ScrollView>

      <FiltersSheet
        visible={filtersOpen}
        title={t.catalog.filters.title}
        showLabel={t.catalog.filters.showResults}
        resetLabel={t.catalog.filters.reset}
        styleLabel={t.catalog.filters.stylesHeading}
        levelLabel={t.catalog.filters.levelsHeading}
        styles={STYLE_KEYS.map(([key, msg]) => ({ key, label: t.danceStyles[msg] }))}
        levels={[
          { key: 'BEGINNER', label: t.levels.beginner },
          { key: 'INTERMEDIATE', label: t.levels.intermediate },
          { key: 'ADVANCED', label: t.levels.advanced },
          { key: 'PROFESSIONAL', label: t.levels.professional },
        ]}
        selectedStyle={styleFilter}
        selectedLevel={levelFilter}
        onSelectStyle={setStyleFilter}
        onSelectLevel={setLevelFilter}
        onReset={() => {
          setStyleFilter(null);
          setLevelFilter(null);
        }}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}

function SearchField(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  clearLabel: string;
}) {
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = withSpring(props.focused ? 1 : 0, springs.snappy);
  }, [props.focused, ring]);
  const animated = useAnimatedStyle(() => ({
    borderColor: ring.value > 0.5 ? 'rgba(201,59,82,0.7)' : 'rgba(245,241,234,0.1)',
    transform: [{ scale: 1 + ring.value * 0.01 }],
  }));

  return (
    <Animated.View style={[styles.search, animated]}>
      <Ionicons name="search" size={19} color={props.focused ? colors.text : colors.text3} />
      <TextInput
        style={styles.searchInput}
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={colors.text3}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onFocus={props.onFocus}
        onBlur={props.onBlur}
        selectionColor={colors.accentBright}
      />
      {props.value.length > 0 ? (
        <Pressable onPress={() => props.onChange('')} hitSlop={10} accessibilityLabel={props.clearLabel}>
          <Ionicons name="close-circle" size={18} color={colors.text3} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/** Карусель событий: карточки на всю ширину, соседние уменьшаются, фото движется с параллаксом. */
function Spotlight(props: {
  events: EventCard[] | null;
  width: number;
  eyebrow: string;
  locale: Locale;
  freeLabel: string;
  onOpen: (slug: string) => void;
}) {
  const cardWidth = props.width - space.xl * 2;
  const step = cardWidth + space.md;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  if (props.events === null) {
    return (
      <View style={styles.spotlightWrap}>
        <Skeleton height={cardWidth * 1.05} radius={radius.xl} style={{ marginHorizontal: space.xl, width: cardWidth }} />
      </View>
    );
  }
  if (props.events.length === 0) return null;

  return (
    <View style={styles.spotlightWrap}>
      <Animated.FlatList
        horizontal
        data={props.events}
        keyExtractor={(item) => item.slug}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
        renderItem={({ item, index }) => (
          <SpotlightCard
            item={item}
            index={index}
            x={x}
            step={step}
            width={cardWidth}
            eyebrow={props.eyebrow}
            locale={props.locale}
            freeLabel={props.freeLabel}
            onPress={() => props.onOpen(item.slug)}
          />
        )}
      />
      {props.events.length > 1 ? (
        <View style={styles.dots}>
          {props.events.map((item, index) => (
            <Dot key={item.slug} index={index} x={x} step={step} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SpotlightCard(props: {
  item: EventCard;
  index: number;
  x: SharedValue<number>;
  step: number;
  width: number;
  eyebrow: string;
  locale: Locale;
  freeLabel: string;
  onPress: () => void;
}) {
  const { item, index, x, step } = props;
  const range = [(index - 1) * step, index * step, (index + 1) * step];
  const card = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(x.value, range, [0.92, 1, 0.92], Extrapolation.CLAMP) }],
  }));
  const photo = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(x.value, range, [-40, 0, 40], Extrapolation.CLAMP) }, { scale: 1.2 }],
  }));

  return (
    <Animated.View style={[{ width: props.width }, card]}>
      <PressableScale onPress={props.onPress} pressedScale={0.97} style={[styles.spotlight, { height: props.width * 1.05 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, photo]}>
          <LinearGradient colors={['#3A1520', '#140C0F']} style={StyleSheet.absoluteFill} />
          {item.image?.key ? <FadeImage uri={mediaUri(item.image.key)} /> : null}
        </Animated.View>
        <LinearGradient colors={gradients.heroShade} locations={[0.3, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.spotlightTop}>
          <View style={styles.glassPill}>
            <View style={styles.liveDot} />
            <Text style={styles.glassPillText}>{props.eyebrow}</Text>
          </View>
          <View style={styles.spotlightPrice}>
            <Text style={styles.spotlightPriceText}>{item.price > 0 ? price(item.price, props.locale) : props.freeLabel}</Text>
          </View>
        </View>
        <View style={styles.spotlightBody}>
          <View style={styles.dateChip}>
            <Text style={styles.dateDay}>{dateLabel(item.startsAt, props.locale, { day: 'numeric' })}</Text>
            <Text style={styles.dateMonth}>{dateLabel(item.startsAt, props.locale, { month: 'short' })}</Text>
          </View>
          <View style={styles.spotlightText}>
            <Text style={styles.spotlightTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={colors.text2} />
              <Text style={styles.spotlightMeta} numberOfLines={1}>
                {item.locationName} · {item.startTime}
              </Text>
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function Dot({ index, x, step }: { index: number; x: SharedValue<number>; step: number }) {
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * step, index * step, (index + 1) * step];
    return {
      width: interpolate(x.value, range, [6, 22, 6], Extrapolation.CLAMP),
      opacity: interpolate(x.value, range, [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/** Инструкторы «как сторис»: фото в градиентном кольце бренда, имя и рейтинг. */
function Stories({ items, onOpen }: { items: InstructorCard[] | null; onOpen: (slug: string) => void }) {
  if (items === null) {
    return (
      <View style={[styles.row, styles.storiesSkeleton]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.story}>
            <Skeleton width={76} height={76} radius={38} />
            <Skeleton width={60} height={10} />
          </View>
        ))}
      </View>
    );
  }
  if (items.length === 0) return null;
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(item) => item.slug}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
          <PressableScale style={styles.story} onPress={() => onOpen(item.slug)} accessibilityLabel={item.name}>
            <View>
              <View style={styles.storyRing}>
                <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <View style={styles.storyInner}>
                  {item.image?.key ? (
                    <FadeImage uri={mediaUri(item.image.key)} />
                  ) : (
                    <Text style={styles.storyInitials}>{initials(item.name)}</Text>
                  )}
                </View>
              </View>
              {item.isVerified ? (
                <View style={styles.verified}>
                  <Ionicons name="checkmark" size={10} color={colors.bg} />
                </View>
              ) : null}
            </View>
            <Text style={styles.storyName} numberOfLines={1}>
              {item.name.split(' ')[0]}
            </Text>
            {item.ratingAverage > 0 ? (
              <View style={styles.metaRow}>
                <Ionicons name="star" size={10} color={colors.metal} />
                <Text style={styles.storyRating}>{item.ratingAverage.toFixed(1)}</Text>
              </View>
            ) : null}
          </PressableScale>
        </Animated.View>
      )}
    />
  );
}

const BENTO: { section: Section; icon: IconName; desc: 'megaDescClasses' | 'megaDescInstructors' | 'megaDescStudios' | 'megaDescEvents' | 'megaDescShop'; tint: string }[] = [
  { section: 'classes', icon: 'musical-notes', desc: 'megaDescClasses', tint: '#8B1A2B' },
  { section: 'instructors', icon: 'person', desc: 'megaDescInstructors', tint: '#6B4A1E' },
  { section: 'studios', icon: 'business', desc: 'megaDescStudios', tint: '#2E3B5C' },
  { section: 'events', icon: 'sparkles', desc: 'megaDescEvents', tint: '#5C2A5A' },
  { section: 'shop', icon: 'bag-handle', desc: 'megaDescShop', tint: '#2F4F43' },
];

/** Плитки разделов «бенто»: первая — широкая, остальные парами; у каждой свой цветовой тон. */
function Bento({ t, onOpen }: { t: ReturnType<typeof catalogFor>; onOpen: (section: Section) => void }) {
  const [first, ...rest] = BENTO;
  const tile = (entry: (typeof BENTO)[number], wide: boolean, index: number) => (
    <Animated.View key={entry.section} entering={FadeInDown.delay(index * 70).duration(500)} style={wide ? styles.bentoWide : styles.bentoHalf}>
      <PressableScale style={[styles.bento, wide && styles.bentoWideInner]} onPress={() => onOpen(entry.section)}>
        <LinearGradient
          colors={[`${entry.tint}CC`, `${entry.tint}33`, 'rgba(20,16,18,0.9)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name={entry.icon} size={wide ? 120 : 84} color="rgba(245,241,234,0.06)" style={styles.bentoGhost} />
        <View style={styles.bentoIcon}>
          <Ionicons name={entry.icon} size={18} color={colors.text} />
        </View>
        <View style={styles.bentoText}>
          <Text style={wide ? type.h2 : styles.bentoTitle}>{t.nav[entry.section]}</Text>
          <Text style={type.caption} numberOfLines={2}>
            {t.nav[entry.desc]}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
  return (
    <View style={styles.bentoGrid}>
      {tile(first, true, 0)}
      {rest.map((entry, i) => tile(entry, false, i + 1))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 460 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg, paddingHorizontal: space.xl },
  headerText: { flex: 1, gap: 6 },
  greeting: { fontSize: 14, fontWeight: '600', color: colors.text2 },
  heroAccent: { fontFamily: fonts.displayItalic, color: colors.accentBright },
  avatarRing: { width: 48, height: 48, borderRadius: 24, padding: 2, overflow: 'hidden', marginTop: 4 },
  avatar: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  avatarText: { fontSize: 15, fontWeight: '800', color: colors.text },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: space.xl, marginTop: space.xl },
  search: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(245,241,234,0.1)',
  },
  filterButtonActive: { borderColor: colors.accentBright, backgroundColor: colors.accentSoft },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBright,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  filterBadgeText: { fontSize: 11, fontWeight: '800', color: colors.white },
  results: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: 8 },
  loader: { marginVertical: space.lg },
  notice: { ...type.bodySm, paddingHorizontal: space.xl },
  noResults: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  hitIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  hitText: { flex: 1, gap: 2 },
  spotlightWrap: { marginTop: space.xxl },
  spotlight: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface2 },
  spotlightTop: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11,8,9,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentBright },
  glassPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.text },
  spotlightBody: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  dateChip: {
    width: 54,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: 'rgba(245,241,234,0.95)',
  },
  dateDay: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.bg },
  dateMonth: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.accent },
  spotlightText: { flex: 1, gap: 4 },
  spotlightTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spotlightMeta: { fontSize: 13, color: colors.text2, flexShrink: 1 },
  spotlightPrice: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.accent },
  spotlightPriceText: { fontSize: 12, fontWeight: '800', color: colors.white },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.lg },
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.text },
  block: { marginTop: 40, gap: space.lg },
  moodBody: { ...type.bodySm, paddingHorizontal: space.xl, marginTop: -4 },
  row: { paddingHorizontal: space.xl, gap: space.md },
  storiesSkeleton: { flexDirection: 'row' },
  story: { width: 84, alignItems: 'center', gap: 6 },
  storyRing: { width: 80, height: 80, borderRadius: 40, padding: 2.5, overflow: 'hidden' },
  storyInner: {
    flex: 1,
    borderRadius: 38,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 2.5,
    borderColor: colors.bg,
  },
  storyInitials: { fontSize: 20, fontWeight: '800', color: colors.text },
  verified: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.metal,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  storyName: { fontSize: 13, fontWeight: '600', color: colors.text },
  storyRating: { fontSize: 11, fontWeight: '700', color: colors.text2 },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.xl },
  bentoWide: { width: '100%' },
  bentoHalf: { width: '48.2%', flexGrow: 1 },
  bento: {
    height: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: space.lg,
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  bentoWideInner: { height: 140 },
  bentoGhost: { position: 'absolute', right: -14, bottom: -18 },
  bentoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,241,234,0.12)',
  },
  bentoText: { gap: 4 },
  bentoTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  editorial: {
    marginTop: 48,
    marginHorizontal: space.xl,
    padding: space.xxl,
    gap: space.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  editorialTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: colors.text },
  editorialCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: space.sm,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  editorialCtaText: { fontSize: 14, fontWeight: '800', color: colors.bg },
});
