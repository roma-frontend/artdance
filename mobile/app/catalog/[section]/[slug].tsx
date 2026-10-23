import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { FlatList, Linking, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { CollapsingHeader } from '@/components/ui/collapsing-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FadeImage } from '@/components/ui/fade-image';
import { GlassButton } from '@/components/ui/glass-button';
import { MediaCard } from '@/components/ui/media-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { CatalogError, getCatalogDetail, mediaUri, type CatalogItem, type ClassCard, type Section } from '@/lib/catalog';
import { cardView } from '@/lib/catalog-view';
import { dateLabel, initials, levelLabel, plural, price, styleLabel, weekdayShort, webUrl } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors, fill, fonts, gradients, radius, space, type } from '@/theme';

const sections: readonly Section[] = ['classes', 'instructors', 'studios', 'events', 'shop'];

type Detail = Record<string, unknown>;
type IconName = ComponentProps<typeof Ionicons>['name'];
type Review = { id: string; authorName: string; rating: number; body: string; isVerifiedPurchase?: boolean };
type ScheduleEntry = { weekday: number; startTime: string; endTime: string; spotsLeft: number };
type Experience = { title: string; organization?: string; startYear: number; endYear?: number };

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const keyOf = (v: unknown): string | null => str((v as { key?: unknown } | undefined)?.key);

export default function CatalogDetailScreen() {
  const { section, slug } = useLocalSearchParams<{ section: string; slug: string }>();
  const locale = deviceLocale(undefined);
  const m = messagesFor(locale);
  const t = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const valid = sections.find((s) => s === section);
  const heroHeight = Math.min(height * 0.56, 480);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  useEffect(() => {
    if (!valid || !slug) return;
    let alive = true;
    setDetail(null);
    setError(null);
    getCatalogDetail<Detail>(valid, slug)
      .then((data) => alive && setDetail(data))
      .catch((err: unknown) => {
        if (alive) setError(err instanceof CatalogError && err.status === 404 ? m.catalogNotFound : m.catalogError);
      });
    return () => {
      alive = false;
    };
  }, [valid, slug, m.catalogNotFound, m.catalogError]);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-heroHeight, 0, heroHeight], [-heroHeight / 2, 0, heroHeight * 0.45]) },
      { scale: interpolate(scrollY.value, [-heroHeight, 0, heroHeight], [2, 1, 1.08], Extrapolation.CLAMP) },
    ],
  }));
  const heroFade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, heroHeight * 0.8], [0, 0.6], Extrapolation.CLAMP),
  }));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const backButton = <GlassButton icon="chevron-back" label={m.catalogBack} onPress={back} />;

  if (error || !valid) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 60 }]}>
        <View style={[styles.floatingBack, { top: insets.top + 6 }]}>{backButton}</View>
        <EmptyState icon="compass-outline" title={error ?? m.catalogNotFound} actionLabel={m.catalogBack} onAction={back} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.screen}>
        <Skeleton height={heroHeight} radius={0} />
        <View style={[styles.floatingBack, { top: insets.top + 6 }]}>{backButton}</View>
        <View style={styles.loadingBody}>
          <Skeleton width={120} height={12} />
          <Skeleton width="85%" height={30} />
          <Skeleton width="60%" height={14} />
          <View style={styles.factsGrid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width="48%" height={72} radius={radius.md} />
            ))}
          </View>
          <Skeleton height={90} />
        </View>
      </View>
    );
  }

  const title = str(detail.title) ?? str(detail.name) ?? '';
  const about = str(detail.description) ?? str(detail.bio) ?? str(detail.headline);
  const heroKey = keyOf(detail.heroImage) ?? keyOf(detail.image);
  const rating = (detail.rating as { average?: number; count?: number } | undefined) ?? {
    average: num(detail.ratingAverage) ?? 0,
    count: num(detail.ratingCount) ?? 0,
  };
  const reviews = arr<Review>(detail.reviews);
  const schedule = arr<ScheduleEntry>(detail.schedule);
  const learning = arr<string>(detail.learningPoints);
  const related = arr<ClassCard>(valid === 'instructors' ? detail.classes : detail.similar);
  const chips = [
    ...(str(detail.style) ? [styleLabel(detail.style as string, t)] : []),
    ...(str(detail.level) ? [levelLabel(detail.level as string, t)] : []),
    ...arr<string>(detail.styles).map((s) => styleLabel(s, t)),
    ...(str(detail.brand) ? [detail.brand as string] : []),
    ...(str(detail.district) ? [detail.district as string] : []),
  ].slice(0, 5);

  const facts = buildFacts(valid, detail, t, locale);
  const amount = num(detail.price) ?? num(detail.hourlyRateFrom) ?? num(detail.pricePerHour);
  const perUnit = valid === 'classes' ? t.common.labels.perClass : valid === 'instructors' || valid === 'studios' ? t.common.labels.perHour : null;
  const bookSlug = valid === 'classes' ? str(detail.instructorSlug) : valid === 'instructors' ? slug : null;
  const isFull = valid === 'classes' && num(detail.spotsLeft) === 0;

  const share = () => {
    const url = webUrl(locale, `/${valid}/${slug}`);
    Share.share({ message: `${title}\n${url}`, url }).catch(() => undefined);
  };
  const cta = () => {
    if (bookSlug) router.push({ pathname: '/book/[instructor]', params: { instructor: bookSlug } });
    else Linking.openURL(webUrl(locale, `/${valid}/${slug}`)).catch(() => undefined);
  };

  return (
    <View style={styles.screen}>
      <CollapsingHeader
        scrollY={scrollY}
        title={title}
        threshold={heroHeight - insets.top - 70}
        left={backButton}
        right={<GlassButton icon="share-outline" label={t.common.actions.share} onPress={share} />}
      />

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View style={[{ height: heroHeight }, styles.hero, heroStyle]}>
          <LinearGradient colors={['#3A1520', '#140C0F']} style={StyleSheet.absoluteFill} />
          {heroKey ? <FadeImage uri={mediaUri(heroKey)} /> : null}
          <LinearGradient colors={['rgba(11,8,9,0.55)', 'rgba(11,8,9,0)']} style={styles.heroTopShade} />
          <LinearGradient colors={gradients.heroShade} locations={[0.5, 0.75, 1]} style={StyleSheet.absoluteFill} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.heroDim, heroFade]} />
        </Animated.View>

        <View style={styles.sheet}>
          <Animated.View entering={FadeInDown.duration(550)} style={styles.titleBlock}>
            <Text style={type.eyebrow}>{t.nav[valid]}</Text>
            <Text style={styles.title}>{title}</Text>
            {(rating.count ?? 0) > 0 ? (
              <View style={styles.ratingRow}>
                <Stars value={rating.average ?? 0} />
                <Text style={styles.ratingText}>
                  {(rating.average ?? 0).toFixed(1)} · {plural(t.common.counts.reviews, rating.count ?? 0, locale)}
                </Text>
              </View>
            ) : null}
            {chips.length > 0 ? (
              <View style={styles.chips}>
                {chips.map((chip) => (
                  <View key={chip} style={styles.chip}>
                    <Text style={styles.chipText}>{chip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Animated.View>

          {facts.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(80).duration(550)} style={styles.factsGrid}>
              {facts.map((fact) => (
                <View key={fact.label} style={styles.fact}>
                  <View style={styles.factIcon}>
                    <Ionicons name={fact.icon} size={16} color={colors.accentBright} />
                  </View>
                  <Text style={type.caption}>{fact.label}</Text>
                  <Text style={styles.factValue} numberOfLines={2}>
                    {fact.value}
                  </Text>
                </View>
              ))}
            </Animated.View>
          ) : null}

          {about ? (
            <Block title={valid === 'instructors' ? t.instructor.aboutTitle.replace('{name}', title.split(' ')[0]) : t.classDetail.aboutTitle} delay={140}>
              <Text style={type.body} numberOfLines={expanded ? undefined : 5}>
                {about}
              </Text>
              {about.length > 240 ? (
                <PressableScale onPress={() => setExpanded((v) => !v)} style={styles.more} haptic={false}>
                  <Text style={styles.moreText}>{expanded ? t.common.actions.showLess : t.common.actions.showMore}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.accentBright} />
                </PressableScale>
              ) : null}
            </Block>
          ) : null}

          {learning.length > 0 ? (
            <Block title={t.classDetail.learnTitle}>
              {learning.map((point) => (
                <View key={point} style={styles.learnRow}>
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={13} color={colors.white} />
                  </View>
                  <Text style={[type.body, styles.flex]}>{point}</Text>
                </View>
              ))}
            </Block>
          ) : null}

          {valid === 'classes' && str(detail.instructorSlug) ? (
            <Block title={t.classDetail.instructorTitle}>
              <PressableScale
                style={styles.person}
                pressedScale={0.98}
                onPress={() => router.push({ pathname: '/catalog/[section]/[slug]', params: { section: 'instructors', slug: detail.instructorSlug as string } })}
              >
                <View style={styles.personAvatar}>
                  {keyOf(detail.instructorImage) ? (
                    <FadeImage uri={mediaUri(keyOf(detail.instructorImage) as string)} />
                  ) : (
                    <Text style={styles.personInitials}>{initials(str(detail.instructorName) ?? '')}</Text>
                  )}
                </View>
                <View style={styles.flex}>
                  <View style={styles.personName}>
                    <Text style={type.title} numberOfLines={1}>
                      {str(detail.instructorName)}
                    </Text>
                    {detail.instructorVerified ? <Ionicons name="checkmark-circle" size={16} color={colors.metal} /> : null}
                  </View>
                  <Text style={type.caption} numberOfLines={2}>
                    {str(detail.instructorHeadline)}
                  </Text>
                  {(num(detail.instructorRating) ?? 0) > 0 ? (
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color={colors.metal} />
                      <Text style={styles.ratingText}>{(detail.instructorRating as number).toFixed(1)}</Text>
                    </View>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text3} />
              </PressableScale>
            </Block>
          ) : null}

          {schedule.length > 0 ? (
            <Block title={t.classDetail.scheduleTitle}>
              <View style={styles.list}>
                {schedule.slice(0, 4).map((entry, index) => (
                  <View key={`${entry.weekday}-${entry.startTime}-${index}`} style={[styles.scheduleRow, index > 0 && styles.divider]}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayText}>{weekdayShort(entry.weekday, locale)}</Text>
                    </View>
                    <Text style={[styles.scheduleTime, styles.flex]}>
                      {entry.startTime} – {entry.endTime}
                    </Text>
                    <Text style={[styles.spots, entry.spotsLeft <= 3 && styles.spotsLow]}>
                      {plural(t.common.counts.spotsLeft, entry.spotsLeft, locale)}
                    </Text>
                  </View>
                ))}
              </View>
            </Block>
          ) : null}

          {arr<Experience>(detail.experience).length > 0 ? (
            <Block title={t.instructor.experienceTitle}>
              {arr<Experience>(detail.experience).map((entry, index, all) => (
                <View key={`${entry.title}-${entry.startYear}`} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={styles.timelineDot} />
                    {index < all.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={[styles.flex, styles.timelineBody]}>
                    <Text style={type.caption}>
                      {entry.startYear} — {entry.endYear ?? t.instructor.experiencePresent}
                    </Text>
                    <Text style={type.title}>{entry.title}</Text>
                    {entry.organization ? <Text style={type.bodySm}>{entry.organization}</Text> : null}
                  </View>
                </View>
              ))}
            </Block>
          ) : null}

          {arr<string>(detail.amenities).length > 0 ? (
            <Block title={t.common.labels.studio}>
              <View style={styles.chips}>
                {arr<string>(detail.amenities).map((a) => (
                  <View key={a} style={styles.chip}>
                    <Text style={styles.chipText}>{a}</Text>
                  </View>
                ))}
              </View>
            </Block>
          ) : null}

          {reviews.length > 0 ? (
            <Block title={t.classDetail.reviewsTitle} flush>
              <FlatList
                horizontal
                data={reviews}
                keyExtractor={(r) => r.id}
                showsHorizontalScrollIndicator={false}
                snapToInterval={width * 0.78 + space.md}
                decelerationRate="fast"
                contentContainerStyle={styles.hRow}
                renderItem={({ item }) => (
                  <View style={[styles.review, { width: width * 0.78 }]}>
                    <Stars value={item.rating} />
                    <Text style={[type.body, styles.reviewBody]} numberOfLines={5}>
                      “{item.body}”
                    </Text>
                    <View style={styles.reviewAuthor}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewInitials}>{initials(item.authorName)}</Text>
                      </View>
                      <Text style={type.label}>{item.authorName}</Text>
                      {item.isVerifiedPurchase ? <Ionicons name="shield-checkmark" size={14} color={colors.success} /> : null}
                    </View>
                  </View>
                )}
              />
            </Block>
          ) : null}

          {related.length > 0 ? (
            <Block title={valid === 'instructors' ? t.instructor.classesTitle : t.classDetail.similarTitle} flush>
              <FlatList
                horizontal
                data={related}
                keyExtractor={(c) => c.slug}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hRow}
                renderItem={({ item }) => {
                  const view = cardView(item as CatalogItem, t, locale);
                  return (
                    <MediaCard
                      width={150}
                      uri={view.uri}
                      title={view.title}
                      meta={view.meta}
                      badge={view.badge}
                      price={view.price}
                      onPress={() => router.push({ pathname: '/catalog/[section]/[slug]', params: { section: 'classes', slug: item.slug } })}
                    />
                  );
                }}
              />
            </Block>
          ) : null}
        </View>
      </Animated.ScrollView>

      <Animated.View entering={FadeIn.delay(250)} style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.ctaTint} />
        <View style={styles.flex}>
          {amount !== null ? (
            <>
              <Text style={type.caption} numberOfLines={1}>
                {valid === 'instructors' ? t.common.labels.from : t.common.labels.price}
                {perUnit && amount > 0 ? ` · ${perUnit}` : ''}
              </Text>
              <Text style={styles.ctaPrice} numberOfLines={1} adjustsFontSizeToFit>
                {amount > 0 ? price(amount, locale) : t.common.labels.free}
              </Text>
            </>
          ) : (
            <Text style={type.label} numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>
        <Button
          label={bookSlug ? (isFull ? t.common.actions.joinWaitlist : t.common.actions.bookNow) : m.openOnWeb}
          icon={bookSlug ? 'calendar' : 'open-outline'}
          onPress={cta}
          style={styles.ctaButton}
        />
      </Animated.View>
    </View>
  );
}

function buildFacts(section: Section, d: Detail, t: ReturnType<typeof catalogFor>, locale: ReturnType<typeof deviceLocale>) {
  const facts: { icon: IconName; label: string; value: string }[] = [];
  const add = (icon: IconName, label: string, value: string | null) => {
    if (value) facts.push({ icon, label, value });
  };
  if (section === 'classes') {
    const weekday = num(d.weekday);
    add('calendar-outline', t.common.labels.date, weekday !== null ? `${weekdayShort(weekday, locale)}, ${str(d.startTime) ?? ''}` : null);
    const duration = num(d.durationMinutes);
    add('time-outline', t.common.labels.duration, duration !== null ? plural(t.common.units.minutes, duration, locale) : null);
    add('location-outline', t.common.labels.location, [str(d.venueName), str(d.venueDistrict)].filter(Boolean).join(', ') || null);
    const capacity = num(d.capacity);
    add('people-outline', t.common.labels.capacity, capacity !== null ? t.classDetail.capacityNote.replace('{count}', String(capacity)) : null);
  } else if (section === 'events') {
    add('calendar-outline', t.common.labels.date, str(d.startsAt) ? dateLabel(d.startsAt as string, locale, { weekday: 'short', day: 'numeric', month: 'long' }) : null);
    add('time-outline', t.common.labels.time, str(d.startTime) ? `${d.startTime as string} – ${str(d.endTime) ?? ''}` : null);
    add('location-outline', t.common.labels.location, str(d.locationName));
    const spots = num(d.spotsLeft);
    add('ticket-outline', t.common.labels.capacity, spots !== null ? plural(t.common.counts.spotsLeft, spots, locale) : null);
  } else if (section === 'instructors') {
    const years = num(d.yearsExperience);
    add('ribbon-outline', t.common.labels.experience, years !== null ? plural(t.common.units.years, years, locale) : null);
    const students = num(d.studentCount);
    add('people-outline', t.common.labels.students, students ? plural(t.common.counts.students, students, locale) : null);
    add('language-outline', t.common.labels.language, arr<string>(d.languages).map((l) => l.toUpperCase()).join(' · ') || null);
  } else if (section === 'studios') {
    add('location-outline', t.common.labels.location, str(d.district));
  } else if (section === 'shop') {
    const stock = num(d.stock);
    add('cube-outline', t.common.labels.quantity, stock !== null ? String(stock) : null);
  }
  return facts;
}

function Stars({ value }: { value: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'} size={13} color={colors.metal} />
      ))}
    </View>
  );
}

function Block({ title, children, delay = 0, flush }: { title: string; children: ReactNode; delay?: number; flush?: boolean }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(550)} style={[styles.block, flush && styles.blockFlush]}>
      <Text style={[type.h3, flush && styles.padded]}>{title}</Text>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  padded: { paddingHorizontal: space.xl },
  scroll: { paddingBottom: 140 },
  floatingBack: { position: 'absolute', left: 16, zIndex: 30 },
  loadingBody: { padding: space.xl, gap: space.md },
  hero: { overflow: 'hidden', backgroundColor: colors.surface2 },
  heroTopShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  heroDim: { backgroundColor: colors.bg },
  sheet: {
    marginTop: -32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.bg,
    paddingTop: space.xxl,
    gap: 32,
  },
  titleBlock: { paddingHorizontal: space.xl, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.text, letterSpacing: -0.3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  stars: { flexDirection: 'row', gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.xl },
  fact: {
    width: '47.5%',
    flexGrow: 1,
    padding: space.lg,
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  factIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginBottom: 6,
  },
  factValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  block: { paddingHorizontal: space.xl, gap: space.md },
  blockFlush: { paddingHorizontal: 0 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  moreText: { fontSize: 14, fontWeight: '700', color: colors.accentBright },
  learnRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginTop: 1,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  personAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  personInitials: { fontSize: 18, fontWeight: '800', color: colors.text },
  personName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: space.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  dayBadge: {
    width: 44,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surface2,
  },
  dayText: { fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase' },
  scheduleTime: { fontSize: 15, fontWeight: '600', color: colors.text },
  spots: { fontSize: 12, fontWeight: '600', color: colors.text2 },
  spotsLow: { color: colors.danger },
  timelineRow: { flexDirection: 'row', gap: 14 },
  timelineRail: { width: 12, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, backgroundColor: colors.accentBright },
  timelineLine: { flex: 1, width: 2, marginTop: 4, backgroundColor: colors.lineStrong },
  timelineBody: { gap: 2, paddingBottom: space.lg },
  hRow: { paddingHorizontal: space.xl, gap: space.md },
  review: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  reviewBody: { color: colors.text, fontStyle: 'italic' },
  reviewAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  reviewInitials: { fontSize: 11, fontWeight: '800', color: colors.text },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingTop: 14,
    paddingHorizontal: space.xl,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
  },
  ctaTint: { ...fill, backgroundColor: 'rgba(11,8,9,0.6)' },
  ctaPrice: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text },
  ctaButton: { minWidth: 150 },
});
