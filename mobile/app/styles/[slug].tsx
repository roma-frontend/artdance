import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StyleHubSkeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FadeImage } from '@/components/ui/fade-image';
import { MediaCard } from '@/components/ui/media-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { mediaUri, type Section } from '@/lib/catalog';
import { cardView } from '@/lib/catalog-view';
import { levelLabel, plural, price, styleKey, styleLabel } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { getStyleHub, StylesError, type StyleHub } from '@/lib/styles';
import { colors, fill, gradients, radius, space, type } from '@/theme';

/** Подставляет название направления в шаблон словаря (`{style}`). */
function withStyle(template: string, label: string): string {
  return template.replace('{style}', label);
}

/** Хаб направления: занятия, преподаватели, залы и соседние направления. Данные — `/api/content/styles/[slug]`. */
export default function StyleHubScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const locale = deviceLocale(undefined);
  const t = catalogFor(locale);
  const m = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.46);
  const heroHeight = Math.min(height * 0.52, 480);

  const [hub, setHub] = useState<StyleHub | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    setHub(null);
    setError(null);
    getStyleHub(slug)
      .then((data) => alive && setHub(data))
      .catch((err: unknown) => {
        if (alive) setError(err instanceof StylesError && err.status === 404 ? m.catalogNotFound : m.catalogError);
      });
    return () => {
      alive = false;
    };
  }, [slug, m.catalogNotFound, m.catalogError]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const backButton = (
    <PressableScale
      onPress={back}
      accessibilityRole="button"
      accessibilityLabel={t.common.actions.back}
      style={[screenStyles.back, { top: insets.top + space.sm }]}
    >
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </PressableScale>
  );

  if (error) {
    return (
      <View style={[screenStyles.screen, { paddingTop: insets.top + space.xxxl }]}>
        {backButton}
        <EmptyState icon="alert-circle-outline" title={error} actionLabel={m.catalogBack} onAction={back} />
      </View>
    );
  }

  if (!hub) {
    return (
      <View style={screenStyles.screen}>
        {backButton}
        <StyleHubSkeleton heroHeight={heroHeight} cardWidth={cardWidth} />
      </View>
    );
  }

  const label = styleLabel(hub.style, t);
  const key = styleKey(hub.style);
  const copy = key ? t.styleHub.styles[key] : null;

  const openStyle = (slugValue: string) => router.push({ pathname: '/styles/[slug]', params: { slug: slugValue } });
  const openCatalog = (section: Section, extra: Record<string, string> = {}) =>
    router.push({ pathname: '/catalog/[section]', params: { section, style: hub.slug, styleName: label, ...extra } });
  const openItem = (section: Section, itemSlug: string) =>
    router.push({ pathname: '/catalog/[section]/[slug]', params: { section, slug: itemSlug } });

  const priceText = hub.priceFrom !== null ? `${t.common.labels.from} ${price(hub.priceFrom, locale)}` : null;
  const levelsText = hub.levels.length > 0 ? hub.levels.map((level) => levelLabel(level, t)).join(' · ') : null;

  return (
    <Animated.View entering={FadeIn.duration(320)} style={screenStyles.screen}>
      {backButton}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={{ height: heroHeight }}>
          {hub.image ? (
            <FadeImage uri={mediaUri(hub.image.key)} style={fill} />
          ) : (
            <View style={[fill, { backgroundColor: colors.surface2 }]} />
          )}
          <LinearGradient colors={gradients.heroShade} style={fill} />
          <Animated.View entering={FadeInDown.duration(420)} style={screenStyles.heroText}>
            <Text style={type.eyebrow}>{t.nav.styles}</Text>
            <Text style={[type.hero, screenStyles.heroTitle]}>{withStyle(t.styleHub.title, label)}</Text>
            {copy ? <Text style={[type.body, screenStyles.lede]}>{copy.lede}</Text> : null}
          </Animated.View>
        </View>

        <View style={screenStyles.content}>
          <View style={screenStyles.badges}>
            <Badge text={plural(t.common.counts.classes, hub.classCount, locale)} />
            <Badge text={plural(t.common.counts.instructors, hub.instructorCount, locale)} />
            {levelsText ? <Badge text={levelsText} /> : null}
            {priceText ? <Badge text={priceText} /> : null}
          </View>

          {copy ? (
            <View style={screenStyles.section}>
              <Text style={type.h2}>{withStyle(t.styleHub.aboutTitle, label)}</Text>
              <Text style={type.body}>{copy.about}</Text>
            </View>
          ) : null}

          {copy ? (
            <View style={screenStyles.section}>
              <Text style={type.h2}>{t.styleHub.gearTitle}</Text>
              <Text style={type.body}>{copy.gear}</Text>
            </View>
          ) : null}

          <View style={screenStyles.section}>
            <SectionHead
              title={withStyle(t.styleHub.classesTitle, label)}
              actionLabel={withStyle(t.styleHub.classesAll, label)}
              onAction={() => openCatalog('classes')}
            />
            {hub.classes.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title={withStyle(t.styleHub.classesEmptyTitle, label)}
                body={withStyle(t.styleHub.classesEmptyBody, label)}
                actionLabel={t.nav.applyInstructor}
                onAction={() => router.push('/become-instructor')}
              />
            ) : (
              <HorizontalRow>
                {hub.classes.map((item) => {
                  const view = cardView(item, t, locale);
                  return (
                    <MediaCard
                      key={view.slug}
                      uri={view.uri}
                      title={view.title}
                      meta={view.meta}
                      badge={view.badge}
                      price={view.price}
                      width={cardWidth}
                      onPress={() => openItem('classes', view.slug)}
                    />
                  );
                })}
              </HorizontalRow>
            )}
          </View>

          <View style={screenStyles.section}>
            <SectionHead
              title={withStyle(t.styleHub.instructorsTitle, label)}
              actionLabel={withStyle(t.styleHub.instructorsAll, label)}
              onAction={() => openCatalog('instructors')}
            />
            {hub.instructors.length === 0 ? (
              <Text style={type.bodySm}>{withStyle(t.styleHub.instructorsEmptyBody, label)}</Text>
            ) : (
              <HorizontalRow>
                {hub.instructors.map((item) => {
                  const view = cardView(item, t, locale);
                  return (
                    <MediaCard
                      key={view.slug}
                      uri={view.uri}
                      title={view.title}
                      meta={view.meta}
                      rating={view.rating}
                      width={cardWidth}
                      onPress={() => openItem('instructors', view.slug)}
                    />
                  );
                })}
              </HorizontalRow>
            )}
          </View>

          {hub.venues.length > 0 ? (
            <View style={screenStyles.section}>
              <SectionHead
                title={withStyle(t.styleHub.studiosTitle, label)}
                actionLabel={t.styleHub.studiosAll}
                onAction={() => openCatalog('studios')}
              />
              <HorizontalRow>
                {hub.venues.map((item) => {
                  const view = cardView(item, t, locale);
                  return (
                    <MediaCard
                      key={view.slug}
                      uri={view.uri}
                      title={view.title}
                      meta={view.meta}
                      width={cardWidth}
                      onPress={() => openItem('studios', view.slug)}
                    />
                  );
                })}
              </HorizontalRow>
            </View>
          ) : null}

          {hub.related.length > 0 ? (
            <View style={screenStyles.section}>
              <Text style={type.h2}>{withStyle(t.styleHub.relatedTitle, label)}</Text>
              <Text style={type.bodySm}>{t.styleHub.relatedSubtitle}</Text>
              <View style={screenStyles.chips}>
                {hub.related.map((related) => (
                  <PressableScale
                    key={related.slug}
                    onPress={() => openStyle(related.slug)}
                    accessibilityRole="button"
                    accessibilityLabel={styleLabel(related.style, t)}
                    style={screenStyles.chip}
                  >
                    <Text style={type.label}>{styleLabel(related.style, t)}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}

          <View style={screenStyles.cta}>
            <Text style={type.h2}>{withStyle(t.styleHub.cta.title, label)}</Text>
            <Text style={type.bodySm}>{t.styleHub.cta.subtitle}</Text>
            <Button label={t.styleHub.cta.primary} onPress={() => openCatalog('classes')} />
            <Button label={t.styleHub.cta.secondary} variant="ghost" onPress={() => openCatalog('instructors')} />
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={screenStyles.badge}>
      <Text style={type.bodySm}>{text}</Text>
    </View>
  );
}

function SectionHead({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <View style={screenStyles.sectionHead}>
      <Text style={[type.h2, screenStyles.sectionTitle]}>{title}</Text>
      <PressableScale onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
        <Text style={[type.label, { color: colors.accentBright }]}>{actionLabel}</Text>
      </PressableScale>
    </View>
  );
}

function HorizontalRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={screenStyles.row}>
      {children}
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  back: {
    position: 'absolute',
    left: space.xl,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  heroText: { position: 'absolute', left: space.xl, right: space.xl, bottom: space.xl, gap: space.sm },
  heroTitle: { marginTop: space.xs },
  lede: { marginTop: space.xs },
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.xxl },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  sectionTitle: { flex: 1 },
  row: { gap: space.md, paddingVertical: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  cta: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
});
