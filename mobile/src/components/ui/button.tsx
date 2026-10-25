import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { accentGlow, colors, fill, gradients, radius, type } from '@/theme';
import { PressableScale } from './pressable-scale';

type Props = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'ghost';
  style?: StyleProp<ViewStyle>;
};

/** Основная кнопка: бургунди-градиент со свечением, пружина и тактильный «тук». */
export function Button({ label, onPress, busy, disabled, icon, variant = 'primary', style }: Props) {
  const inactive = disabled || busy;
  const primary = variant === 'primary';
  return (
    <PressableScale
      onPress={() => {
        if (primary) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        onPress();
      }}
      disabled={inactive}
      haptic={!primary}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      style={[styles.base, primary ? accentGlow : styles.ghost, disabled && styles.disabled, style]}
    >
      {primary ? (
        <View style={styles.clip}>
          <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
      {busy ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={18} color={primary ? colors.white : colors.text} /> : null}
          <Text style={[type.button, styles.label, !primary && { color: colors.text }]} numberOfLines={2}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  clip: { ...fill, borderRadius: radius.md, overflow: 'hidden' },
  ghost: { backgroundColor: 'rgba(245,241,234,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  label: { textAlign: 'center', flexShrink: 1 },
});
