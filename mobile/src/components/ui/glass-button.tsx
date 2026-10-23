import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { ComponentProps } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';
import { PressableScale } from './pressable-scale';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  label: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Круглая «стеклянная» кнопка поверх фото: назад, поделиться, закрыть. */
export function GlassButton({ icon, onPress, label, size = 40, style }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      pressedScale={0.88}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <Ionicons name={icon} size={size * 0.5} color={colors.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(20,16,18,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
});
