import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, radius, space, type } from '@/theme';

type Mode = 'date' | 'time';

type Props = {
  label: string;
  mode: Mode;
  /** `YYYY-MM-DD` для даты, `HH:mm` для времени; пустая строка — не выбрано. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  error?: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(mode: Mode, value: string, fallback: Date): Date {
  if (mode === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : fallback;
  }
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const date = new Date(fallback);
  if (match) date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

function fromDate(mode: Mode, date: Date): string {
  return mode === 'date'
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Поле даты или времени с системным выбором: на Android — диалог, на iOS — встроенный календарь
 * или барабан под полем. В браузере нативного выбора нет, поэтому там остаётся ввод текстом.
 */
export function DateTimeField({ label, mode, value, onChange, placeholder, minimumDate, maximumDate, disabled, error }: Props) {
  const [open, setOpen] = useState(false);
  const current = toDate(mode, value, minimumDate ?? new Date());

  if (Platform.OS === 'web') {
    return (
      <View style={styles.field}>
        <Text style={type.caption}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? (mode === 'date' ? 'YYYY-MM-DD' : 'HH:mm')}
          placeholderTextColor={colors.text3}
          editable={!disabled}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.box, styles.text, error ? styles.boxError : null]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(fromDate(mode, date));
  };

  const press = () => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode, is24Hour: true, minimumDate, maximumDate, onChange: handle });
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <View style={styles.field}>
      <Text style={type.caption}>{label}</Text>
      <Pressable
        onPress={press}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || placeholder || '' }}
        accessibilityState={{ disabled, expanded: open }}
        style={[styles.box, open && styles.boxOpen, error ? styles.boxError : null]}
      >
        <Text style={[styles.text, !value && styles.placeholder]}>{value || placeholder || '—'}</Text>
        <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={16} color={colors.text3} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {open && Platform.OS === 'ios' ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <DateTimePicker
            value={current}
            mode={mode}
            display={mode === 'date' ? 'inline' : 'spinner'}
            is24Hour
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant="dark"
            accentColor={colors.accentBright}
            onChange={handle}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: space.xs },
  box: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    borderWidth: 1,
    borderColor: 'rgba(245,241,234,0.14)',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  boxOpen: { borderColor: colors.accentBright },
  boxError: { borderColor: colors.danger },
  text: { color: colors.text, fontSize: 15, fontVariant: ['tabular-nums'] },
  placeholder: { color: colors.text3 },
  error: { fontSize: 12, color: colors.danger },
});
