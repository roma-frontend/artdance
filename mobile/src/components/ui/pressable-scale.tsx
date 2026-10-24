import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { springs } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<ComponentProps<typeof Pressable>, 'style' | 'ref'> & {
  style?: StyleProp<ViewStyle>;
  /** Насколько карточка «утапливается» под пальцем. */
  pressedScale?: number;
  haptic?: boolean;
};

/** Pressable с пружинным сжатием и тактильной отдачей; при удержании — сильный толчок и импульс. */
export function PressableScale({
  style,
  pressedScale = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  onLongPress,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  // Системная настройка «уменьшить движение»: без пружинного сжатия, только тактильный отклик.
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event: GestureResponderEvent) => {
        if (!reduceMotion) scale.value = withSpring(pressedScale, springs.press);
        if (haptic) Haptics.selectionAsync().catch(() => undefined);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        if (!reduceMotion) scale.value = withSpring(1, springs.press);
        onPressOut?.(event);
      }}
      onLongPress={
        onLongPress
          ? (event: GestureResponderEvent) => {
              if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
              if (!reduceMotion) {
                scale.value = withSequence(
                  withTiming(pressedScale - 0.03, { duration: 90 }),
                  withSpring(pressedScale, springs.press),
                );
              }
              onLongPress?.(event);
            }
          : undefined
      }
      style={[style, animated]}
    />
  );
}
