import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

import { brandLogoHeight } from '@/components/brand-logo';
import { BRAND_LOGO_LAYERS, BRAND_LOGO_VIEWBOX } from '@/components/brand-logo-paths';

const LOGO_WIDTH = 260;
const LOGO_HEIGHT = brandLogoHeight(LOGO_WIDTH);
const LOGO_VIEW_WIDTH = 1151;
const SHINE_WIDTH = 300;
const GOLD = '#C9A96A';
const ROSE = '#C93B52';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** Искры разлетаются по окружности: угол в градусах. */
const SPARKS = [
  { angle: -90, delay: 650 },
  { angle: -45, delay: 700 },
  { angle: 0, delay: 740 },
  { angle: 45, delay: 780 },
  { angle: 90, delay: 720 },
  { angle: 135, delay: 760 },
  { angle: 180, delay: 680 },
  { angle: -135, delay: 800 },
];

/** Кольца и ореолы: размер и прозрачность подобраны под тёмный фон. */
const HALOS = [
  { size: 380, alpha: 0.06, delay: 0 },
  { size: 280, alpha: 0.1, delay: 120 },
  { size: 200, alpha: 0.16, delay: 240 },
];

export function SplashLoader() {
  const fade = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const shine = useSharedValue(0);
  const track = useSharedValue(0);

  useEffect(() => {
    fade.value = withDelay(100, withTiming(1, { duration: 500 }));
    scale.value = withDelay(100, withSpring(1, { damping: 13, stiffness: 140 }));
    shine.value = withDelay(700, withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) }));
    track.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }), -1, false);
  }, [fade, scale, shine, track]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: scale.value }],
  }));

  const shineProps = useAnimatedProps(() => ({
    x: -SHINE_WIDTH + shine.value * (LOGO_VIEW_WIDTH + SHINE_WIDTH),
  }));

  const line = useAnimatedStyle(() => ({ transform: [{ translateX: -60 + track.value * 120 }] }));

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A0B10', '#0B0809', '#0B0809']} style={StyleSheet.absoluteFill} />

      <View style={styles.stage}>
        {HALOS.map((halo) => (
          <Halo key={halo.size} size={halo.size} alpha={halo.alpha} delay={halo.delay} />
        ))}
        {[0, 450].map((delay) => (
          <Ring key={delay} delay={delay} />
        ))}
        {SPARKS.map((spark) => (
          <Spark key={spark.angle} angle={spark.angle} delay={spark.delay} />
        ))}

        <Animated.View style={logoStyle}>
          <Svg width={LOGO_WIDTH} height={LOGO_HEIGHT} viewBox={BRAND_LOGO_VIEWBOX}>
            <Defs>
              <ClipPath id="logoClip">
                {BRAND_LOGO_LAYERS.map((layer) => (
                  <Path key={layer.fill} d={layer.d} />
                ))}
              </ClipPath>
              <SvgGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFF4DC" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </SvgGradient>
            </Defs>
            {BRAND_LOGO_LAYERS.map((layer) => (
              <Path key={layer.fill} d={layer.d} fill={layer.fill} />
            ))}
            <G clipPath="url(#logoClip)">
              <AnimatedRect y={0} width={SHINE_WIDTH} height={389} fill="url(#shineGrad)" animatedProps={shineProps} />
            </G>
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.line, line]} />
      </View>
    </View>
  );
}

function Halo({ size, alpha, delay }: { size: number; alpha: number; delay: number }) {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [breath, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: alpha * (0.6 + breath.value * 0.4),
    transform: [{ scale: 0.92 + breath.value * 0.12 }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.halo, { width: size, height: size, borderRadius: size / 2 }, style]} />;
}

function Ring({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay + 300, withRepeat(withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }), -1, false));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - progress.value),
    transform: [{ scale: 0.6 + progress.value * 1.8 }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
}

function Spark({ angle, delay }: { angle: number; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => {
    const radians = (angle * Math.PI) / 180;
    const distance = 60 + progress.value * 150;
    const opacity = progress.value < 0.2 ? progress.value / 0.2 : 1 - (progress.value - 0.2) / 0.8;
    return {
      opacity,
      transform: [
        { translateX: Math.cos(radians) * distance },
        { translateY: Math.sin(radians) * distance },
        { scale: 1 - progress.value * 0.5 },
      ],
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.spark, style]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0809', gap: 28 },
  stage: { width: 400, height: 400, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: ROSE },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: GOLD },
  spark: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#E8D2A4' },
  track: { width: 120, height: 2, borderRadius: 1, overflow: 'hidden', backgroundColor: 'rgba(245,241,234,0.08)' },
  line: { width: 60, height: 2, borderRadius: 1, backgroundColor: GOLD },
});
