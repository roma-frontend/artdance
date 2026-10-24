import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StyleIndexSkeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { MediaCard } from '@/components/ui/media-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { mediaUri } from '@/lib/catalog';
import { plural, styleLabel } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { listStyles, type StyleSummary } from '@/lib/styles';
import { colors, radius, space, type } from '@/theme';

/** Перечень направлений: сначала с занятиями и кадром, затем полный список строками. */
export default function StylesIndexScreen() {
  const locale = deviceLocale(undefined);
  const t = catalogFor(locale);
  const m = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - space.xl * 2 - space.md) / 2);

  const [items, setItems] = useState<StyleSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    listStyles()
      .then((list) => alive && setItems(list))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openStyle = (slug: string) => router.push({ pathname: '/styles/[slug]', params: { slug } });

  const live = items?.filter((s) => s.classCount > 0 && s.image) ?? [];

  return (
    <ScrollView
      style={screenStyles.screen}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(420)} style={screenStyles.header}>
        <PressableScale onPress={back} accessibilityRole="button" accessibilityLabel={t.common.actions.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
      </Animated.View>

      <View style={screenStyles.intro}>
        <Text style={type.eyebrow}>{t.nav.styles}</Text>
        <Text style={[type.h1, screenStyles.introTitle]}>{t.styleHub.index.title}</Text>
        <Text style={[type.bodySm, screenStyles.introSubtitle]}>{t.styleHub.index.subtitle}</Text>
      </View>

      {failed ? (
        <EmptyState icon="alert-circle-outline" title={m.catalogError} actionLabel={m.catalogBack} onAction={back} />
      ) : null}

      {!items && !failed ? <StyleIndexSkeleton cardWidth={cardWidth} /> : null}

      {items && live.length > 0 ? (
        <Animated.View entering={FadeIn.duration(360)} style={screenStyles.section}>
          <Text style={type.h2}>{t.styleHub.index.liveTitle}</Text>
          <Text style={[type.bodySm, screenStyles.sectionSubtitle]}>{t.styleHub.index.liveSubtitle}</Text>
          <View style={screenStyles.grid}>
            {live.map((s) => (
              <MediaCard
                key={s.slug}
                uri={s.image ? mediaUri(s.image.key) : undefined}
                title={styleLabel(s.style, t)}
                meta={plural(t.common.counts.classes, s.classCount, locale)}
                width={cardWidth}
                onPress={() => openStyle(s.slug)}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}

      {items ? (
        <Animated.View entering={FadeIn.duration(360)} style={screenStyles.section}>
          <Text style={type.h2}>{t.styleHub.index.allTitle}</Text>
          <Text style={[type.bodySm, screenStyles.sectionSubtitle]}>{t.styleHub.index.allSubtitle}</Text>
          <View style={screenStyles.list}>
            {items.map((s) => {
              const label = styleLabel(s.style, t);
              return (
                <PressableScale
                  key={s.slug}
                  onPress={() => openStyle(s.slug)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={screenStyles.row}
                >
                  <View style={screenStyles.rowBody}>
                    <Text style={type.title}>{label}</Text>
                    <Text style={type.caption}>
                      {s.classCount === 0 ? t.styleHub.seeking : plural(t.common.counts.classes, s.classCount, locale)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.md },
  intro: { paddingHorizontal: space.xl, gap: space.sm, marginBottom: space.xl },
  introTitle: { marginTop: space.xs },
  introSubtitle: { marginTop: space.xs },
  section: { paddingHorizontal: space.xl, marginBottom: space.xxl, gap: space.sm },
  sectionSubtitle: { marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.lg },
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowBody: { flex: 1, gap: 2 },
});
