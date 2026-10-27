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

import { colors, gradients, shadow } from '@/theme';

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
export function CountUp({ value, style }: { value: number; style?: TextStyle }) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
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
  }, [value]);

  return <Text style={style}>{shown.toLocaleString()}</Text>;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Герой-знак: вращающееся градиентное кольцо, «дышащее» свечение и щит по центру. */
export function ShieldOrb({ size = 112, icon = 'shield-checkmark' }: { size?: number; icon?: IconName }) {
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(breathe);
    };
  }, [spin, breathe, reduceMotion]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const glow = useAnimatedStyle(() => ({
    opacity: 0.35 + breathe.value * 0.45,
    transform: [{ scale: 0.9 + breathe.value * 0.18 }],
  }));

  const ringInset = Math.round(size * 0.05);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={[styles.glow, { width: size * 1.5, height: size * 1.5, borderRadius: size * 0.75 }, glow]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }, ring]}>
        <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View
        style={[
          styles.core,
          {
            top: ringInset + 3,
            left: ringInset + 3,
            right: ringInset + 3,
            bottom: ringInset + 3,
            borderRadius: size / 2,
          },
        ]}
      >
        <Ionicons name={icon} size={Math.round(size * 0.38)} color={colors.accentBright} />
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
  glow: { position: 'absolute', backgroundColor: colors.accentBright, ...shadow },
  core: { position: 'absolute', backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  glassCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,16,18,0.7)',
  },
});
