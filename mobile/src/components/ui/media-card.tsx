import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fill, gradients, radius, type } from '@/theme';
import { FadeImage } from './fade-image';
import { PressableScale } from './pressable-scale';

type Props = {
  uri?: string;
  title: string;
  meta?: string;
  badge?: string | null;
  price?: string;
  rating?: number;
  onPress: () => void;
  width?: number;
  aspect?: number;
  style?: StyleProp<ViewStyle>;
};

/** Постер: фото с проявлением, мягкая тень снизу, бейдж, рейтинг и цена-«пилюля» поверх фото. */
export function MediaCard({ uri, title, meta, badge, price, rating, onPress, width, aspect = 4 / 3, style }: Props) {
  return (
    <PressableScale onPress={onPress} style={[{ width }, style]} accessibilityRole="button" accessibilityLabel={title}>
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
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
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
      </View>
      <Text style={[type.title, styles.title]} numberOfLines={2}>
        {title}
      </Text>
      {meta ? (
        <Text style={type.caption} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  placeholder: { ...fill, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 10, marginBottom: 2 },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.white, letterSpacing: 0.6, textTransform: 'uppercase' },
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
});
