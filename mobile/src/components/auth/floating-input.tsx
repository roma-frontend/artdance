import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, Ref } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors, radius, springs } from '@/theme';

/** Поле с «всплывающей» подписью, подсветкой фокуса и показом пароля по глазу. */
export function FloatingInput({
  label,
  icon,
  value,
  onChangeText,
  secureTextEntry,
  onFocus,
  onBlur,
  style,
  ref,
  ...rest
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  value: string;
  onChangeText: (text: string) => void;
  ref?: Ref<TextInputInstance>;
} & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'placeholder' | 'ref'>) {
  const t = messagesFor(deviceLocale(undefined));
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const lift = useSharedValue(value.length > 0 ? 1 : 0);
  const glow = useSharedValue(0);

  useEffect(() => {
    lift.value = withSpring(focused || value.length > 0 ? 1 : 0, springs.snappy);
  }, [focused, value, lift]);

  const field = useAnimatedStyle(() => ({
    borderColor: interpolateColor(glow.value, [0, 1], ['rgba(245,241,234,0.12)', 'rgba(201,59,82,0.85)']),
    backgroundColor: interpolateColor(glow.value, [0, 1], ['rgba(20,16,18,0.6)', 'rgba(40,18,24,0.7)']),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(lift.value, [0, 1], [0, -11]) }, { scale: interpolate(lift.value, [0, 1], [1, 0.75]) }],
    color: interpolateColor(glow.value, [0, 1], [colors.text3, '#E8A0AB']),
  }));

  return (
    <Animated.View style={[styles.field, field]}>
      <Ionicons name={icon} size={18} color={focused ? '#E8A0AB' : colors.text3} />
      <View style={styles.body}>
        <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {label}
        </Animated.Text>
        <TextInput
          {...rest}
          ref={ref}
          style={[styles.input, style]}
          value={value}
          onChangeText={onChangeText}
          onFocus={(event) => {
            setFocused(true);
            glow.value = withTiming(1, { duration: 200 });
            Haptics.selectionAsync().catch(() => undefined);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            glow.value = withTiming(0, { duration: 200 });
            onBlur?.(event);
          }}
          secureTextEntry={hidden}
          placeholderTextColor="transparent"
          selectionColor={colors.accentBright}
          accessibilityLabel={label}
        />
      </View>
      {secureTextEntry ? (
        <Pressable
          onPress={() => setHidden((v) => !v)}
          hitSlop={12}
          style={styles.eye}
          accessibilityRole="button"
          accessibilityLabel={hidden ? t.showPassword : t.hidePassword}
        >
          <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.text3} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  body: { flex: 1, justifyContent: 'center', alignSelf: 'stretch' },
  label: { position: 'absolute', left: 0, fontSize: 16, transformOrigin: 'left center' },
  input: { fontSize: 16, color: colors.text, paddingTop: 22, paddingBottom: 8, minHeight: 58 },
  eye: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
