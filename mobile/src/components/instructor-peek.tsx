import { Ionicons } from '@expo/vector-icons';
import { GlassBackdrop } from '@/components/ui/glass-backdrop';
import * as Haptics from 'expo-haptics';
import { useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Skeleton } from '@/components/skeleton';
import { FadeImage } from '@/components/ui/fade-image';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { listAvailableSlots, type Slot } from '@/lib/bookings';
import { instructorPeekVideoUri, mediaUri, type InstructorCard } from '@/lib/catalog';
import { FavoritesError, listMyFavorites, toggleMyFavorite } from '@/lib/favorites';
import { dateLabel, initials } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { colors, gradients, radius, shadow, space, type } from '@/theme';

type Props = {
  instructor: InstructorCard;
  onClose: () => void;
  onBook: (slug: string) => void;
};

/** Ближайший свободный слот: `undefined` — загружается, `null` — свободных нет. */
type NextSlot = Slot | null | undefined;

const FRAME_MAX_WIDTH = 232;

/**
 * Превью инструктора по долгому нажатию на «сторис»: ближайший слот
 * подгружается на лету, избранное переключается без перехода в профиль.
 */
export function InstructorPeek({ instructor, onClose, onBook }: Props) {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [nextSlot, setNextSlot] = useState<NextSlot>(undefined);
  // `null` — статус ещё не известен (список избранного грузится), `false` — не сохранено или не вошёл.
  const [saved, setSaved] = useState<boolean | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    listAvailableSlots(instructor.slug)
      .then((slots) => alive && setNextSlot(slots[0] ?? null))
      .catch(() => alive && setNextSlot(null));
    listMyFavorites()
      .then((items) => alive && setSaved(items.some((item) => item.kind === 'instructor' && item.slug === instructor.slug)))
      .catch(() => alive && setSaved(false));
    return () => {
      alive = false;
    };
  }, [instructor.slug]);

  // Аппаратная «назад» на Android закрывает превью, а не уводит с экрана.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  // Длительность совпадает с роликом (8 с).
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
  }, [progress, reduceMotion]);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const toggleSave = async () => {
    if (saved === null) return;
    try {
      const next = await toggleMyFavorite('instructor', instructor.slug);
      setSaved(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      if (error instanceof FavoritesError && error.status === 401) Alert.alert(c.favorites.signInRequired);
    }
  };

  const when =
    nextSlot
      ? dateLabel(nextSlot.startIso, locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : null;
  const frameWidth = Math.min(width - space.xl * 4, FRAME_MAX_WIDTH);
  const enter = reduceMotion ? FadeIn.duration(160) : ZoomIn.duration(320).easing(EASE_OUT);
  const exit = reduceMotion ? FadeOut.duration(120) : ZoomOut.duration(180);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={c.common.actions.close}>
          <GlassBackdrop intensity={35} />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </Pressable>
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View entering={enter} exiting={exit} style={[styles.card, shadow]}>
          <View style={{ width: frameWidth }}>
            <Animated.View style={[styles.halo, { opacity: 0.5 }]} pointerEvents="none">
              <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={styles.frame}>
              <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.media}>
                {instructor.image?.key ? (
                  <FadeImage uri={mediaUri(instructor.image.key)} />
                ) : (
                  <View style={styles.placeholder}>
                    <Text style={styles.initials}>{initials(instructor.name)}</Text>
                  </View>
                )}
                {reduceMotion ? null : <PeekVideo uri={instructorPeekVideoUri(instructor.slug)} />}
                {reduceMotion ? null : (
                  <View style={styles.progressTrack} pointerEvents="none">
                    <Animated.View style={[styles.progressFill, progressStyle]} />
                  </View>
                )}
                <LinearGradient colors={gradients.heroShade} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <LinearGradient colors={['rgba(11,8,9,0.6)', 'rgba(11,8,9,0)']} style={styles.topShade} pointerEvents="none" />
                <View style={styles.header}>
                  <View style={styles.avatarRing}>
                    <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    <View style={styles.avatar}>
                      {instructor.image?.key ? (
                        <FadeImage uri={mediaUri(instructor.image.key)} />
                      ) : (
                        <View style={styles.placeholder}>
                          <Text style={styles.avatarInitials}>{initials(instructor.name)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {instructor.name}
                    </Text>
                    {instructor.isVerified ? (
                      <Animated.View entering={ZoomIn.delay(200).springify().damping(12)}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.metal} />
                      </Animated.View>
                    ) : null}
                  </View>
                  <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={c.common.actions.close}>
                    <Ionicons name="close" size={24} color={colors.white} />
                  </Pressable>
                </View>
                <Animated.View entering={FadeInUp.delay(60).duration(320)} style={styles.textBlock}>
                  {instructor.headline ? (
                    <Text style={styles.headline} numberOfLines={2}>
                      {instructor.headline}
                    </Text>
                  ) : null}
                  {instructor.ratingAverage > 0 ? (
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color={colors.metal} />
                      <Text style={styles.rating}>
                        {c.instructor.statsRating.replace('{rating}', instructor.ratingAverage.toFixed(1)).replace('{count}', String(instructor.ratingCount))}
                      </Text>
                    </View>
                  ) : null}
                </Animated.View>
                <View style={styles.sideColumn}>
                  <PressableScale
                    style={[styles.sideButton, saved === true && styles.sideButtonActive]}
                    onPress={toggleSave}
                    disabled={saved === null}
                    accessibilityRole="button"
                    accessibilityLabel={saved ? c.common.actions.removeFromFavorites : c.common.actions.addToFavorites}
                    pressedScale={0.9}
                  >
                    <Animated.View key={String(saved)} entering={ZoomIn.springify().damping(12).stiffness(260)}>
                      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={24} color={saved ? colors.accentBright : colors.white} />
                    </Animated.View>
                  </PressableScale>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.slotWrap}>
            {nextSlot === undefined ? (
              <Skeleton width={180} height={28} radius={radius.pill} />
            ) : when ? (
              <Animated.View entering={FadeInUp.delay(140).duration(340)} style={styles.slot}>
                <View style={styles.slotDot} />
                <Text style={styles.slotText}>{c.instructor.quickBookNext.replace('{when}', when)}</Text>
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <PressableScale
              style={styles.primary}
              onPress={() => onBook(instructor.slug)}
              accessibilityRole="button"
              accessibilityLabel={c.common.actions.book}
            >
              <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.primaryText}>{c.common.actions.book}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </PressableScale>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/** Фото под видео остаётся на месте до готовности ролика; сбой загрузки оставляет фото. */
function PeekVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  const [ready, setReady] = useState(player.status === 'readyToPlay');
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') setReady(true);
  });

  if (!ready) return null;
  return (
    <Animated.View entering={FadeIn.duration(360)} style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(11,8,9,0.45)' },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    alignItems: 'center',
    padding: space.lg,
    paddingBottom: space.xl,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: 'rgba(28,22,24,0.94)',
  },
  halo: {
    position: 'absolute',
    top: -14,
    right: -14,
    bottom: -14,
    left: -14,
    borderRadius: radius.xl + 14,
    overflow: 'hidden',
  },
  frame: { aspectRatio: 9 / 16, borderRadius: radius.xl, padding: 2, overflow: 'hidden' },
  media: { flex: 1, borderRadius: radius.xl - 2, overflow: 'hidden', backgroundColor: colors.surface2 },
  placeholder: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 44, fontWeight: '800', color: colors.text },
  progressTrack: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    right: space.md,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,241,234,0.28)',
  },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.text },
  textBlock: { position: 'absolute', left: space.lg, right: space.lg + 52, bottom: space.lg, gap: space.xs },
  topShade: { position: 'absolute', top: 0, right: 0, left: 0, height: 120 },
  header: { position: 'absolute', top: space.xl, left: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatarRing: { width: 36, height: 36, borderRadius: 18, padding: 2, overflow: 'hidden' },
  avatar: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface2 },
  avatarInitials: { fontSize: 13, fontWeight: '800', color: colors.text },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  name: {
    ...type.title,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sideColumn: { position: 'absolute', right: space.md, bottom: space.lg },
  sideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,8,9,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,241,234,0.22)',
  },
  sideButtonActive: { backgroundColor: colors.accentSoft, borderColor: 'rgba(201,59,82,0.45)' },
  headline: { ...type.bodySm, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  rating: { ...type.caption, color: colors.text2 },
  slotWrap: { minHeight: 34, marginTop: space.lg, alignItems: 'center', justifyContent: 'center' },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,59,82,0.45)',
  },
  slotDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  slotText: { fontSize: 13, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xl, alignSelf: 'stretch' },
  primary: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  primaryText: { ...type.button },
});
