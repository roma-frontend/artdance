import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { colors, fill, radius, springs } from '@/theme';

/**
 * Одноразовый код: ряд ячеек поверх скрытого TextInput. iOS предлагает код из SMS над клавиатурой
 * (`oneTimeCode`), Android читает его по `sms-otp`. Ввод по одной цифре, вставка и автозаполнение
 * приходят в одно и то же место, поэтому лишние символы отбрасываются.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
  accessibilityLabel,
}: {
  value: string;
  onChange: (digits: string) => void;
  onComplete: (digits: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  accessibilityLabel: string;
}) {
  const inputRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Подсвечиваем ячейку, куда пойдёт следующая цифра; у заполненного ряда — последнюю.
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, index) => (
        <Cell key={index} char={value[index]} active={!disabled && index === activeIndex} />
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete(digits);
        }}
        editable={!disabled}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        accessibilityLabel={accessibilityLabel}
        style={styles.hidden}
      />
    </View>
  );
}

/** Одна ячейка: пружинит, когда в неё ввели цифру. */
function Cell({ char, active }: { char: string | undefined; active: boolean }) {
  const pop = useSharedValue(1);

  useEffect(() => {
    if (char) pop.value = withSequence(withSpring(1.1, springs.snappy), withSpring(1, springs.snappy));
  }, [char, pop]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[styles.cell, active && styles.cellActive, popStyle]}>
      <Text style={styles.digit}>{char ?? ''}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, height: 60 },
  cell: {
    flex: 1,
    maxWidth: 52,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,241,234,0.12)',
    backgroundColor: 'rgba(20,16,18,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: colors.accentBright, backgroundColor: colors.accentSoft },
  digit: { color: colors.text, fontSize: 24, fontWeight: '700' },
  hidden: { ...fill, color: 'transparent', backgroundColor: 'transparent' },
});
