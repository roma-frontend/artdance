import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = { uri: string; style?: StyleProp<ImageStyle> };

/** Фото проявляется плавно после загрузки — без «мигания» пустого кадра. */
export function FadeImage({ uri, style }: Props) {
  const opacity = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, animated]}>
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, style]}
        resizeMode="cover"
        onLoad={() => {
          opacity.value = withTiming(1, { duration: 450 });
        }}
      />
    </Animated.View>
  );
}
