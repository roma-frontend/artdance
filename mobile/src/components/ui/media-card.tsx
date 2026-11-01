import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fill, gradients, radius, type } from '@/theme';
import { FadeImage } from './fade-image';
import { PressableScale } from './pressable-scale';

/** Цвет бейджа: бренд, «новое» (зелёный) и премиальный (золото). */
export type BadgeTone = 'accent' | 'fresh' | 'premium';

type Props = {
  uri?: string;
  title: string;
  meta?: string;
  badge?: string | null;
  badgeTone?: BadgeTone;
  /** Короткая метка в правом нижнем углу постера: уровень, формат, возраст. */
  corner?: string | null;
  price?: string;
  rating?: number;
  onPress: () => void;
  onLongPress?: () => void;
  width?: number;
  aspect?: number;
  style?: StyleProp<ViewStyle>;
};

const BADGE_COLORS: Record<BadgeTone, string> = {
  accent: colors.accent,
  fresh: colors.success,
  premium: colors.metal,
};

/**
 * Постер: фото с проявлением, мягкая тень снизу, рейтинг и цена-«пилюля» поверх фото.
 * Бейдж выступает за левый край постера, как у витрин онлайн-кинотеатров: он читается
 * первым и не перекрывает лицо на фото.
 */
export function MediaCard({
  uri,
  title,
  meta,
  badge,
  badgeTone = 'accent',
  corner,
  price,
  rating,
  onPress,
  onLongPress,
  width,
  aspect = 4 / 3,
  style,
}: Props) {
  return (
    <PressableScale
      tilt
      onPress={onPress}
      onLongPress={onLongPress}
      style={[{ width }, style]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.wrap}>
        <View style={[styles.frame, { aspectRatio: 1 / aspect }]}>
          <LinearGradient colors={['#2A1D21', '#160F12']} style={StyleSheet.absoluteFill} />
          {uri ? (
            <FadeImage uri={uri} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="musical-notes" size={28} color={colors.text3} />
            </View>
          )}
          <LinearGradient colors={gradients.heroShade} locations={[0.45, 0.7, 1]} style={StyleSheet.absoluteFill} />
          {typeof rating === 'number' && rating > 0 ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={11} color={colors.metal} />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          ) : null}
          {price ? (
            <View style={styles.price}>
              <Text style={styles.priceText}>{price}</Text>
            </View>
          ) : null}
          {corner ? (
            <View style={styles.corner}>
              <Text style={styles.cornerText}>{corner}</Text>
            </View>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: BADGE_COLORS[badgeTone] }]}>
            <Text style={[styles.badgeText, badgeTone === 'premium' && styles.badgeTextDark]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[type.title, styles.title]} numberOfLines={2}>
        {title}
      </Text>
      {meta ? (
        <Text style={[type.caption, styles.meta]} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  frame: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  placeholder: { ...fill, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 10, marginBottom: 2 },
  meta: { color: colors.text3 },
  badge: {
    position: 'absolute',
    top: 10,
    left: -4,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.white, letterSpacing: 0.4 },
  badgeTextDark: { color: colors.bg },
  rating: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  ratingText: { fontSize: 11, fontWeight: '700', color: colors.text },
  price: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245,241,234,0.94)',
  },
  priceText: { fontSize: 12, fontWeight: '800', color: colors.bg },
  corner: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,241,234,0.45)',
    backgroundColor: 'rgba(11,8,9,0.45)',
  },
  cornerText: { fontSize: 10, fontWeight: '700', color: colors.text },
});
