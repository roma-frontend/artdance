import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';

/** Пульсирующая точка «онлайн»: ореол расходится и гаснет. */
export function PulseDot({ color = colors.success, size = 8 }: { color?: string; size?: number }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.7, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 3]) }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.halo, { width: size, height: size, borderRadius: size, backgroundColor: color }, halo]} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

/** Числа плавно набирают значение; при смене значения анимация идёт от текущего. */
export function CountUp({ value, style }: { value: number; style?: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const from = shownRef.current;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min((Date.now() - start) / 900, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (value - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduceMotion]);

  return <Text style={style}>{shown.toLocaleString()}</Text>;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Герой-знак: тонкое золотое кольцо с бегущей точкой, матовый диск и щит. Все слои внутри размера, без теней. */
export function ShieldOrb({ size = 112, icon = 'shield-checkmark' }: { size?: number; icon?: IconName }) {
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(breathe);
    };
  }, [spin, breathe, reduceMotion]);

  const arc = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const glow = useAnimatedStyle(() => ({ opacity: interpolate(breathe.value, [0, 1], [0.14, 0.26]) }));

  const radius = size / 2;
  const stroke = Math.max(1, Math.round(size * 0.014));
  const coreInset = Math.round(size * 0.12);
  return (
    <View style={[styles.orb, { width: size, height: size, borderRadius: radius }]}>
      <Animated.View pointerEvents="none" style={[styles.orbGlow, { borderRadius: radius }, glow]} />
      <View pointerEvents="none" style={[styles.orbTrack, { borderRadius: radius }]} />
      <Animated.View pointerEvents="none" style={[styles.orbArc, { borderRadius: radius, borderWidth: stroke }, arc]}>
        <View style={[styles.orbDot, { left: radius - 2.5, top: -stroke }]} />
      </Animated.View>
      <View style={[styles.core, { top: coreInset, left: coreInset, right: coreInset, bottom: coreInset, borderRadius: radius }]}>
        <LinearGradient
          colors={['rgba(139,26,43,0.45)', 'rgba(11,8,9,0.96)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name={icon} size={Math.round(size * 0.36)} color={colors.metal} />
      </View>
    </View>
  );
}

/** Для списков: карточка с «стеклянной» заливкой и тонкой верхней подсветкой. */
export function GlassCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.glassCard, style]}>
      <LinearGradient
        colors={['rgba(245,241,234,0.09)', 'rgba(245,241,234,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: 'absolute' },
  orb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orbGlow: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.accentBright },
  orbTrack: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,182,110,0.22)' },
  orbArc: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderColor: 'transparent', borderTopColor: colors.metal },
  orbDot: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: colors.metal },
  core: { position: 'absolute', overflow: 'hidden', backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  glassCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,16,18,0.7)',
  },
});
