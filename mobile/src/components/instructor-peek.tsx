import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
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
import { mediaUri, type InstructorCard } from '@/lib/catalog';
import { FavoritesError, listMyFavorites, toggleMyFavorite } from '@/lib/favorites';
import { dateLabel, initials } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { colors, gradients, radius, shadow, space, type } from '@/theme';

type Props = {
  instructor: InstructorCard;
  onClose: () => void;
  onBook: (slug: string) => void;
};

/** Ближайший свободный слот: `undefined` — загружается, `null` — свободных нет. */
type NextSlot = Slot | null | undefined;

const CARD_MAX_WIDTH = 340;
const AVATAR = 96;

/**
 * Превью инструктора по долгому нажатию на «сторис»: ореол дышит, ближайший слот
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
  const pulse = useSharedValue(0);

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

  // Медленное дыхание ореола; при «уменьшить движение» остаётся статичным.
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse, reduceMotion]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.22 + pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.09 }],
  }));

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
  const cardWidth = Math.min(width - space.xl * 2, CARD_MAX_WIDTH);
  const enter = reduceMotion ? FadeIn.duration(160) : ZoomIn.springify().damping(16).stiffness(190);
  const exit = reduceMotion ? FadeOut.duration(120) : ZoomOut.duration(180);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={c.common.actions.close}>
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </Pressable>
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View entering={enter} exiting={exit} style={[styles.card, shadow, { width: cardWidth }]}>
          <View style={styles.avatarWrap}>
            <Animated.View style={[styles.halo, halo]} pointerEvents="none">
              <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={styles.ring}>
              <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.inner}>
                {instructor.image?.key ? (
                  <FadeImage uri={mediaUri(instructor.image.key)} />
                ) : (
                  <Text style={styles.initials}>{initials(instructor.name)}</Text>
                )}
              </View>
            </View>
            {instructor.isVerified ? (
              <Animated.View entering={ZoomIn.delay(200).springify().damping(12)} style={styles.verified}>
                <Ionicons name="checkmark" size={13} color={colors.bg} />
              </Animated.View>
            ) : null}
          </View>

          <Animated.View entering={FadeInUp.delay(60).duration(320)} style={styles.textBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {instructor.name}
            </Text>
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
              style={[styles.secondary, saved === true && styles.secondaryActive]}
              onPress={toggleSave}
              disabled={saved === null}
              accessibilityRole="button"
              accessibilityLabel={saved ? c.common.actions.removeFromFavorites : c.common.actions.addToFavorites}
              pressedScale={0.92}
            >
              <Animated.View key={String(saved)} entering={ZoomIn.springify().damping(12).stiffness(260)}>
                <Ionicons name={saved ? 'heart' : 'heart-outline'} size={21} color={saved ? colors.accentBright : colors.text} />
              </Animated.View>
            </PressableScale>

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
    padding: space.xxl,
    paddingTop: space.xxxl,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: 'rgba(28,22,24,0.94)',
  },
  avatarWrap: { width: AVATAR, height: AVATAR, alignSelf: 'center' },
  halo: {
    position: 'absolute',
    top: -12,
    left: -12,
    width: AVATAR + 24,
    height: AVATAR + 24,
    borderRadius: (AVATAR + 24) / 2,
    overflow: 'hidden',
  },
  ring: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, padding: 3, overflow: 'hidden' },
  inner: {
    flex: 1,
    borderRadius: (AVATAR - 6) / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  initials: { fontSize: 26, fontWeight: '800', color: colors.text },
  verified: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.metal,
    borderWidth: 2,
    borderColor: colors.surface2,
  },
  textBlock: { alignItems: 'center', marginTop: space.lg, gap: space.xs, alignSelf: 'stretch' },
  name: { ...type.h2, textAlign: 'center' },
  headline: { ...type.bodySm, textAlign: 'center' },
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
  secondary: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  secondaryActive: { backgroundColor: colors.accentSoft, borderColor: 'rgba(201,59,82,0.45)' },
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
