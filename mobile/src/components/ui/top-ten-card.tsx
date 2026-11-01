import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gradients, radius, type } from '@/theme';
import { FadeImage } from './fade-image';
import { PressableScale } from './pressable-scale';

type Props = {
  rank: number;
  uri?: string;
  title: string;
  meta?: string;
  rating?: number;
  onPress: () => void;
  onLongPress?: () => void;
  /** Ширина постера без цифры. */
  width?: number;
};

/** Сколько места цифра занимает слева от постера: двузначная шире. */
export function topTenNumeralSpace(rank: number): number {
  return rank >= 10 ? 62 : 40;
}

/**
 * Карточка рейтинга «Топ-10»: крупная цифра слева, постер её частично перекрывает.
 * Приём витрин онлайн-кинотеатров — место в рейтинге читается раньше названия.
 */
export function TopTenCard({ rank, uri, title, meta, rating, onPress, onLongPress, width = 124 }: Props) {
  const height = Math.round(width * 1.5);
  const offset = topTenNumeralSpace(rank);

  return (
    <PressableScale
      tilt
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width: width + offset }}
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${title}`}
    >
      <View style={{ height }}>
        <Text style={[styles.numeral, { fontSize: height * 0.62, lineHeight: height * 0.72 }]} numberOfLines={1} allowFontScaling={false}>
          {rank}
        </Text>
        <View style={[styles.poster, { width, height, marginLeft: offset }]}>
          <LinearGradient colors={['#2A1D21', '#160F12']} style={StyleSheet.absoluteFill} />
          {uri ? <FadeImage uri={uri} /> : null}
          <LinearGradient colors={gradients.heroShade} locations={[0.5, 0.75, 1]} style={StyleSheet.absoluteFill} />
          {typeof rating === 'number' && rating > 0 ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={11} color={colors.metal} />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={[type.title, styles.title, { marginLeft: offset }]} numberOfLines={1}>
        {title}
      </Text>
      {meta ? (
        <Text style={[type.caption, styles.meta, { marginLeft: offset }]} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  numeral: {
    position: 'absolute',
    left: -4,
    bottom: -10,
    fontFamily: fonts.display,
    color: colors.bg,
    textShadowColor: colors.metal,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
    letterSpacing: -6,
  },
  poster: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  rating: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  ratingText: { fontSize: 11, fontWeight: '700', color: colors.text },
  title: { marginTop: 10, marginBottom: 2 },
  meta: { color: colors.text3 },
});
