import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, fill, radius, springs } from '@/theme';

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
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const startX = useRef(0);

  const settle = (next: boolean) => {
    openRef.current = next;
    setOpen(next);
    const target = next ? -ACTION_WIDTH : 0;
    x.value = reduceMotion ? target : withSpring(target, springs.snappy);
  };

  const pan = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) =>
      !disabled &&
      Math.abs(g.dx) > 8 &&
      Math.abs(g.dx) > Math.abs(g.dy) * 1.5 &&
      (g.dx < 0 || openRef.current),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      startX.current = x.value;
    },
    onPanResponderMove: (_, g) => {
      x.value = Math.max(-ACTION_WIDTH, Math.min(0, startX.current + g.dx));
    },
    onPanResponderRelease: (_, g) => release(g.dx, g.vx),
    onPanResponderTerminate: (_, g) => release(g.dx, g.vx),
  });

  const release = (dx: number, vx: number) => {
    const position = startX.current + dx;
    const next = vx < -0.5 ? true : vx > 0.5 ? false : position < -ACTION_WIDTH / 2;
    if (next && !openRef.current) Haptics.selectionAsync().catch(() => undefined);
    settle(next);
  };

  const frontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.actionArea}>
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
      <Animated.View style={[styles.front, frontStyle]} {...pan.panHandlers}>
        {children}
        {open ? <Pressable style={fill} accessibilityLabel={actionLabel} onPress={() => settle(false)} /> : null}
      </Animated.View>
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
