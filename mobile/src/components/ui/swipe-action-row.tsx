import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, fill, radius, springs } from '@/theme';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

const ACTION_WIDTH = 96;

type Props = {
  children: ReactNode;
  /** Подпись кнопки, которая появляется при свайпе влево. */
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Строка со свайпом влево: открывает кнопку действия. Чтобы действие сработало, кнопку нужно нажать,
 * поэтому случайный свайп ничего не удаляет. Тап по открытой строке закрывает её.
 * Вертикальная прокрутка не перехватывается: жест захватывается только при явно горизонтальном движении.
 */
export function SwipeActionRow({ children, actionLabel, onAction, disabled, style }: Props) {
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  const commit = (next: boolean, wasOpen: boolean) => {
    if (next && !wasOpen) Haptics.selectionAsync().catch(() => undefined);
    setOpen(next);
  };

  const settle = (next: boolean) => {
    setOpen(next);
    const target = next ? -ACTION_WIDTH : 0;
    x.value = reduceMotion ? target : withSpring(target, springs.snappy);
  };

  // Жест ведётся на UI-потоке; вертикальное движение сразу отдаёт его прокрутке списка.
  const pan = usePanGesture({
    enabled: !disabled,
    activeOffsetX: [-10, open ? 10 : 9999],
    failOffsetY: [-10, 10],
    onBegin: () => {
      startX.value = x.value;
    },
    onUpdate: (event) => {
      x.value = Math.max(-ACTION_WIDTH, Math.min(0, startX.value + event.translationX));
    },
    onDeactivate: (event) => {
      const wasOpen = startX.value < -ACTION_WIDTH / 2;
      const next = event.velocityX < -500 ? true : event.velocityX > 500 ? false : x.value < -ACTION_WIDTH / 2;
      const target = next ? -ACTION_WIDTH : 0;
      x.value = reduceMotion ? target : withSpring(target, springs.snappy);
      scheduleOnRN(commit, next, wasOpen);
    },
  });

  const frontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.wrap, style]}>
      {/* Закрытая кнопка не видна диктору; действие доступно через accessibilityActions строки. */}
      <View
        style={styles.actionArea}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        <Pressable
          onPress={() => {
            settle(false);
            onAction();
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.bg} />
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.front, frontStyle]}
          accessibilityActions={disabled ? undefined : [{ name: 'delete', label: actionLabel }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') onAction();
          }}
        >
          {children}
          {open ? (
            <Pressable
              style={fill}
              accessibilityRole="button"
              accessibilityLabel={catalogFor(deviceLocale(undefined)).common.actions.close}
              onPress={() => settle(false)}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bg },
  actionArea: { ...fill, flexDirection: 'row', justifyContent: 'flex-end' },
  action: {
    width: ACTION_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.danger,
  },
  actionPressed: { opacity: 0.85 },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.bg },
  front: { backgroundColor: colors.bg },
});
