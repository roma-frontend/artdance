import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { BRAND_LOGO_SOURCE, brandLogoHeight } from '@/components/brand-logo';

const LOGO_WIDTH = 260;
const LOGO_HEIGHT = brandLogoHeight(LOGO_WIDTH);
const GLINT_WIDTH = 64;
const GOLD = '#C9A96A';
const GLINT_TINT = '#F3DFA8';
const ROSE = '#C93B52';

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
  const reveal = useSharedValue(0);
  const glint = useSharedValue(0);
  const track = useSharedValue(0);

  useEffect(() => {
    fade.value = withDelay(60, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    reveal.value = withDelay(60, withSpring(1, { damping: 15, stiffness: 130 }));
    glint.value = withDelay(850, withTiming(1, { duration: 1050, easing: Easing.inOut(Easing.cubic) }));
    track.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }), -1, false);
  }, [fade, reveal, glint, track]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - reveal.value) * 14 }, { scale: 0.9 + reveal.value * 0.1 }],
  }));

  // Полоса и её золотая копия движутся синхронно: блик виден только внутри букв.
  const glintStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -GLINT_WIDTH + glint.value * (LOGO_WIDTH + GLINT_WIDTH) }],
  }));

  const glintImageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: GLINT_WIDTH - glint.value * (LOGO_WIDTH + GLINT_WIDTH) }],
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

        <Animated.View style={[styles.logo, logoStyle]}>
          <Image source={BRAND_LOGO_SOURCE} style={styles.logoImage} contentFit="contain" />
          <Animated.View pointerEvents="none" style={[styles.glint, glintStyle]}>
            <Animated.View style={[styles.glintImage, glintImageStyle]}>
              <Image source={BRAND_LOGO_SOURCE} style={styles.logoImage} contentFit="contain" tintColor={GLINT_TINT} />
            </Animated.View>
          </Animated.View>
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
  logo: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
  logoImage: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
  glint: { position: 'absolute', top: 0, left: 0, width: GLINT_WIDTH, height: LOGO_HEIGHT, overflow: 'hidden' },
  glintImage: { position: 'absolute', top: 0, left: 0, width: LOGO_WIDTH, height: LOGO_HEIGHT },
  halo: { position: 'absolute', backgroundColor: ROSE },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: GOLD },
  spark: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#E8D2A4' },
  track: { width: 120, height: 2, borderRadius: 1, overflow: 'hidden', backgroundColor: 'rgba(245,241,234,0.08)' },
  line: { width: 60, height: 2, borderRadius: 1, backgroundColor: GOLD },
});
