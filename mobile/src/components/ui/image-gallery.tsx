import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { colors } from '@/theme';
import { FadeImage } from './fade-image';
import { PressableScale } from './pressable-scale';

type Props = {
  uris: readonly string[];
  width: number;
  height: number;
  /** Касание кадра открывает полноэкранный просмотр с этого индекса. */
  onOpen: (index: number) => void;
  openLabel: string;
  onIndexChange?: (index: number) => void;
};

/** Листалка фото в шапке карточки: постранично, с точками, ширина активной точки следует за пальцем. */
export function ImageGallery({ uris, width, height, onOpen, openLabel, onIndexChange }: Props) {
  const offset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.x / Math.max(width, 1);
  });

  return (
    <View style={{ width, height }}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
          onIndexChange?.(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))
        }
      >
        {uris.map((uri, index) => (
          <PressableScale
            key={`${index}:${uri}`}
            pressedScale={0.99}
            haptic={false}
            onPress={() => onOpen(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${openLabel} ${index + 1} / ${uris.length}`}
            style={{ width, height }}
          >
            <FadeImage uri={uri} />
          </PressableScale>
        ))}
      </Animated.ScrollView>
      {uris.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {uris.map((uri, index) => (
            <Dot key={`${index}:${uri}`} index={index} offset={offset} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Dot({ index, offset }: { index: number; offset: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const distance = Math.min(Math.abs(offset.value - index), 1);
    return { width: interpolate(distance, [0, 1], [18, 6]), opacity: interpolate(distance, [0, 1], [1, 0.45]) };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 28, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.white },
});
