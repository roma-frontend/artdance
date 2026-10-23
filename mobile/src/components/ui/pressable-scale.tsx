import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springs } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<ComponentProps<typeof Pressable>, 'style' | 'ref'> & {
  style?: StyleProp<ViewStyle>;
  /** Насколько карточка «утапливается» под пальцем. */
  pressedScale?: number;
  haptic?: boolean;
};

/** Pressable с пружинным сжатием и лёгкой тактильной отдачей — базовый отклик всех карточек и кнопок. */
export function PressableScale({ style, pressedScale = 0.96, haptic = true, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event: GestureResponderEvent) => {
        scale.value = withSpring(pressedScale, springs.press);
        if (haptic) Haptics.selectionAsync().catch(() => undefined);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        scale.value = withSpring(1, springs.press);
        onPressOut?.(event);
      }}
      style={[style, animated]}
    />
  );
}
