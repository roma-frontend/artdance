import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

type Props = { uri: string; style?: StyleProp<ImageStyle>; onError?: () => void };

/**
 * Фото проявляется плавно после загрузки — без «мигания» пустого кадра.
 * expo-image кэширует картинки на диске и в памяти, поэтому повторное открытие экрана мгновенное.
 */
export function FadeImage({ uri, style, onError }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <Image
      source={{ uri }}
      style={[StyleSheet.absoluteFill, style]}
      contentFit="cover"
      transition={reduceMotion ? 0 : 450}
      cachePolicy="memory-disk"
      recyclingKey={uri}
      onError={onError}
    />
  );
}
