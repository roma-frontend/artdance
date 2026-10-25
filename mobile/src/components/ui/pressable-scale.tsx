import * as Haptics from 'expo-haptics';
import { useRef, type ComponentProps } from 'react';
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
const MAX_TILT = 7;

type Props = Omit<ComponentProps<typeof Pressable>, 'style' | 'ref'> & {
  style?: StyleProp<ViewStyle>;
  /** Насколько карточка «утапливается» под пальцем. */
  pressedScale?: number;
  haptic?: boolean;
  /** 3D-наклон к точке касания; только для крупных поверхностей. */
  tilt?: boolean;
};

/** Pressable с пружинным сжатием, 3D-наклоном к пальцу и тактильной отдачей; при удержании — сильный толчок. */
export function PressableScale({
  style,
  pressedScale = 0.96,
  haptic = true,
  tilt = false,
  onPressIn,
  onPressOut,
  onLongPress,
  onLayout,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const size = useRef({ w: 0, h: 0 });
  // Системная настройка «уменьшить движение»: без пружинного сжатия и наклона, только тактильный отклик.
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${tiltX.value}deg` },
      { rotateY: `${tiltY.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onLayout={(event) => {
        size.current = { w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height };
        onLayout?.(event);
      }}
      onPressIn={(event: GestureResponderEvent) => {
        if (!reduceMotion) {
          scale.value = withSpring(pressedScale, springs.press);
          if (tilt && size.current.w > 0) {
            const { locationX, locationY } = event.nativeEvent;
            const nx = Math.min(Math.max((locationX / size.current.w) * 2 - 1, -1), 1);
            const ny = Math.min(Math.max((locationY / size.current.h) * 2 - 1, -1), 1);
            tiltY.value = withSpring(nx * MAX_TILT, springs.press);
            tiltX.value = withSpring(-ny * MAX_TILT, springs.press);
          }
        }
        if (haptic) Haptics.selectionAsync().catch(() => undefined);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        if (!reduceMotion) {
          scale.value = withSpring(1, springs.press);
          tiltX.value = withSpring(0, springs.press);
          tiltY.value = withSpring(0, springs.press);
        }
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
