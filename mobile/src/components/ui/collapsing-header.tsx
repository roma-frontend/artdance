import { GlassBackdrop } from './glass-backdrop';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fill } from '@/theme';

type Props = {
  scrollY: SharedValue<number>;
  title: string;
  /** С какой прокрутки появляется компактная шапка (обычно — когда уходит крупный заголовок). */
  threshold?: number;
  left?: ReactNode;
  right?: ReactNode;
};

/** Компактная шапка в стиле iOS: стекло и заголовок проявляются, когда крупный заголовок уезжает. */
export function CollapsingHeader({ scrollY, title, threshold = 60, left, right }: Props) {
  const insets = useSafeAreaInsets();

  const glass = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [threshold - 30, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [threshold, threshold + 24], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [threshold, threshold + 24], [8, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, glass]} pointerEvents="none">
        <GlassBackdrop intensity={50} />
        <View style={styles.tint} />
        <View style={styles.hairline} />
      </Animated.View>
      <View style={styles.bar} pointerEvents="box-none">
        <View style={styles.side}>{left}</View>
        <Animated.View style={[styles.center, label]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  tint: { ...fill, backgroundColor: 'rgba(11,8,9,0.55)' },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  side: { minWidth: 40, flexDirection: 'row', gap: 8 },
  right: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
});
