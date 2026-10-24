import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, radius as radii, space } from '@/theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Блок-заглушка с бегущим бликом (shimmer), как в Instagram и Airbnb. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const [w, setW] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [progress]);

  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: -w + progress.value * w * 2 }] }));

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[styles.block, { width, height, borderRadius: radius }, style]}
    >
      {w > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, shine]}>
          <LinearGradient
            colors={['rgba(245,241,234,0)', 'rgba(245,241,234,0.07)', 'rgba(245,241,234,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Сетка каталога: большая карточка и два столбца постеров. */
export function ListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <View style={styles.list} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton height={340} radius={radii.xl} />
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.gridRow}>
          {[0, 1].map((c) => (
            <View key={c} style={styles.cell}>
              <Skeleton height={210} radius={radii.lg} />
              <Skeleton width="80%" height={14} />
              <Skeleton width="50%" height={10} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Горизонтальная лента постеров на главной. */
export function PosterRowSkeleton({ count = 3, width = 160 }: { count?: number; width?: number }) {
  return (
    <View style={styles.posterRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width, gap: 8 }}>
          <Skeleton height={width * (4 / 3)} radius={radii.lg} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="50%" height={10} />
        </View>
      ))}
    </View>
  );
}

/**
 * Каркас перечня направлений: блок с сеткой карточек и список строками.
 * Размеры и отступы совпадают с `app/styles/index.tsx`, чтобы не было прыжка при загрузке.
 */
export function StyleIndexSkeleton({ cardWidth, rows = 4 }: { cardWidth: number; rows?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styleSkel.section}>
        <Skeleton width="45%" height={22} />
        <Skeleton width="70%" height={12} />
        <View style={styleSkel.grid}>
          {[0, 1].map((c) => (
            <View key={c} style={{ width: cardWidth, gap: space.sm }}>
              <Skeleton width={cardWidth} height={cardWidth * (4 / 3)} radius={radii.lg} />
              <Skeleton width="80%" height={14} />
              <Skeleton width="50%" height={10} />
            </View>
          ))}
        </View>
      </View>

      <View style={styleSkel.section}>
        <Skeleton width="40%" height={22} />
        <Skeleton width="65%" height={12} />
        <View style={styleSkel.list}>
          {Array.from({ length: rows }, (_, i) => (
            <View key={i} style={styleSkel.listRow}>
              <View style={styleSkel.listBody}>
                <Skeleton width="50%" height={16} />
                <Skeleton width="30%" height={11} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Каркас хаба направления: полноэкранный hero с текстом поверх, ряд бейджей и
 * две горизонтальные ленты карточек. Совпадает с `app/styles/[slug].tsx`.
 */
export function StyleHubSkeleton({ heroHeight, cardWidth }: { heroHeight: number; cardWidth: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ height: heroHeight }}>
        <Skeleton height={heroHeight} radius={0} />
        <View style={styleSkel.heroOverlay}>
          <Skeleton width={90} height={12} />
          <Skeleton width="75%" height={40} />
        </View>
      </View>

      <View style={styleSkel.hubBody}>
        <View style={styleSkel.badgeRow}>
          {[90, 120, 80, 70].map((w) => (
            <Skeleton key={w} width={w} height={30} radius={radii.pill} />
          ))}
        </View>

        {[0, 1].map((s) => (
          <View key={s} style={styleSkel.hubSection}>
            <Skeleton width="55%" height={22} />
            <View style={styleSkel.hRow}>
              {[0, 1].map((c) => (
                <View key={c} style={{ width: cardWidth, gap: space.sm }}>
                  <Skeleton width={cardWidth} height={cardWidth * (4 / 3)} radius={radii.lg} />
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="50%" height={10} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: 'rgba(245,241,234,0.06)', overflow: 'hidden' },
  list: { gap: space.xl },
  gridRow: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1, gap: 8 },
  posterRow: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl },
});

const styleSkel = StyleSheet.create({
  section: { paddingHorizontal: space.xl, marginBottom: space.xxl, gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.lg, marginTop: space.md },
  list: { gap: space.sm, marginTop: space.md },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  listBody: { flex: 1, gap: space.xs },
  heroOverlay: { position: 'absolute', left: space.xl, right: space.xl, bottom: space.xl, gap: space.sm },
  hubBody: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.xxl },
  hubSection: { gap: space.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  hRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
});
