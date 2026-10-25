import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = { intensity?: number; style?: StyleProp<ViewStyle> };

/**
 * Подложка «стекла». iOS размывает фон; на Android expo-blur без BlurTargetView рисует лишь
 * полупрозрачный слой, поэтому там намеренно плотная заливка: текст поверх остаётся читаемым.
 */
export function GlassBackdrop({ intensity = 50, style }: Props) {
  if (Platform.OS === 'android') {
    const alpha = Math.min(Math.max(0.3 + intensity / 100, 0.55), 0.94);
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(18,13,15,${alpha})` }, style]} />;
  }
  return <BlurView pointerEvents="none" intensity={intensity} tint="dark" style={[StyleSheet.absoluteFill, style]} />;
}
