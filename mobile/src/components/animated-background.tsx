import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type OrbProps = {
  color: string;
  size: number;
  top: number;
  left: number;
  duration: number;
  drift: number;
};

function Orb({ color, size, top, left, duration, drift }: OrbProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [duration, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (progress.value - 0.5) * drift },
      { translateY: (0.5 - progress.value) * drift },
      { scale: 0.92 + progress.value * 0.16 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        { width: size, height: size, borderRadius: size / 2, top, left, backgroundImage: `radial-gradient(circle at center, ${color} 0%, transparent 70%)` },
        style,
      ]}
    />
  );
}

export function AnimatedBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#0B0809', '#1C0A11', '#0B0809']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Orb color="rgba(139,26,43,0.85)" size={520} top={-200} left={-200} duration={7000} drift={120} />
      <Orb color="rgba(201,59,82,0.45)" size={420} top={220} left={90} duration={9000} drift={160} />
      <Orb color="rgba(201,169,106,0.22)" size={320} top={60} left={170} duration={13000} drift={90} />
      <Orb color="rgba(110,20,40,0.75)" size={560} top={520} left={-240} duration={11000} drift={140} />
      <LinearGradient colors={['rgba(11,8,9,0)', 'rgba(11,8,9,0.65)']} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', opacity: 0.9 },
});
