import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { getHintSeen, setHintSeen } from '@/lib/session';
import { colors, radius } from '@/theme';

type Props = {
  text: string;
};

/**
 * Встроенная подсказка жеста: рука «постукивает», текст рядом, без затемнения экрана.
 * Показывается один раз на устройстве и скрывается после нажатия.
 */
export function GestureHint({ text }: Props) {
  const [visible, setVisible] = useState(false);
  const tap = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    getHintSeen()
      .then((seen) => {
        if (alive && !seen) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    tap.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 900 }),
      ),
      -1,
    );
  }, [visible, tap]);

  const hand = useAnimatedStyle(() => ({
    transform: [{ translateY: tap.value * 3 }, { scale: 1 - tap.value * 0.12 }],
  }));

  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.delay(600)} exiting={FadeOut}>
      <Pressable
        style={styles.row}
        onPress={() => {
          setVisible(false);
          setHintSeen().catch(() => undefined);
        }}
      >
        <Animated.View style={hand}>
          <Ionicons name="hand-left-outline" size={16} color={colors.metal} />
        </Animated.View>
        <Text style={styles.text}>{text}</Text>
        <Ionicons name="close" size={14} color={colors.text3} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(201,169,106,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,106,0.35)',
  },
  text: { fontSize: 13, fontWeight: '600', color: colors.text },
});
