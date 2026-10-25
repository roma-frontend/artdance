import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture, useExclusiveGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springs } from '@/theme';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_DISTANCE = 120;

type Props = {
  uri: string;
  /** Увеличено ли фото: листалка галереи на это время отключается. */
  onZoomChange: (zoomed: boolean) => void;
  /** Свайп вниз без увеличения закрывает просмотр. */
  onDismiss: () => void;
};

/** Фото на весь экран: щипок, двойной тап и перетаскивание увеличенного кадра на UI-потоке. */
export function ZoomableImage({ uri, onZoomChange: report, onDismiss }: Props) {
  const { width, height } = useWindowDimensions();
  const [zoomed, setZoomed] = useState(false);
  const onZoomChange = useCallback(
    (next: boolean) => {
      setZoomed(next);
      report(next);
    },
    [report],
  );
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const dismissY = useSharedValue(0);

  const clampPan = (value: number, size: number, factor: number) => {
    'worklet';
    const limit = (size * (factor - 1)) / 2;
    return Math.min(Math.max(value, -limit), limit);
  };

  const reset = () => {
    'worklet';
    scale.value = withSpring(1, springs.snappy);
    savedScale.value = 1;
    x.value = withSpring(0, springs.snappy);
    y.value = withSpring(0, springs.snappy);
    savedX.value = 0;
    savedY.value = 0;
    scheduleOnRN(onZoomChange, false);
  };

  const pinch = usePinchGesture({
    onUpdate: (event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, 0.8), MAX_SCALE);
    },
    onDeactivate: () => {
      if (scale.value <= 1.02) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      x.value = withSpring(clampPan(x.value, width, scale.value), springs.snappy);
      y.value = withSpring(clampPan(y.value, height, scale.value), springs.snappy);
      savedX.value = clampPan(x.value, width, scale.value);
      savedY.value = clampPan(y.value, height, scale.value);
      scheduleOnRN(onZoomChange, true);
    },
  });

  const pan = usePanGesture({
    // Без увеличения горизонтальный свайп отдаётся листалке галереи: по X жест не активируется и сразу отпускается.
    // Конфиг без spread: плагин worklets не принимает SpreadElement в объекте хука.
    activeOffsetX: zoomed ? [-6, 6] : [-10000, 10000],
    activeOffsetY: zoomed ? [-6, 6] : [-12, 12],
    failOffsetX: zoomed ? [-10000, 10000] : [-16, 16],
    onUpdate: (event) => {
      if (savedScale.value > 1) {
        x.value = clampPan(savedX.value + event.translationX, width, scale.value);
        y.value = clampPan(savedY.value + event.translationY, height, scale.value);
      } else if (event.translationY > 0) {
        dismissY.value = event.translationY;
      }
    },
    onDeactivate: (event) => {
      if (savedScale.value > 1) {
        savedX.value = x.value;
        savedY.value = y.value;
        return;
      }
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > 900) {
        scheduleOnRN(onDismiss);
      } else {
        dismissY.value = withSpring(0, springs.snappy);
      }
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: (event) => {
      if (event.canceled) return;
      if (savedScale.value > 1) {
        reset();
        return;
      }
      // Увеличение к точке касания, а не к центру кадра.
      const targetX = clampPan((width / 2 - event.x) * (DOUBLE_TAP_SCALE - 1), width, DOUBLE_TAP_SCALE);
      const targetY = clampPan((height / 2 - event.y) * (DOUBLE_TAP_SCALE - 1), height, DOUBLE_TAP_SCALE);
      scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: 240 });
      savedScale.value = DOUBLE_TAP_SCALE;
      x.value = withTiming(targetX, { duration: 240 });
      y.value = withTiming(targetY, { duration: 240 });
      savedX.value = targetX;
      savedY.value = targetY;
      scheduleOnRN(onZoomChange, true);
    },
  });

  const gesture = useExclusiveGestures(doubleTap, useSimultaneousGestures(pinch, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + dismissY.value },
      { scale: scale.value * (1 - Math.min(dismissY.value / (height * 2), 0.25)) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, styles.frame]}>
        <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
