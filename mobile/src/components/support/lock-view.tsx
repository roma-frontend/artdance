import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedBackground } from '@/components/animated-background';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EASE_OUT } from '@/lib/motion';
import { colors, radius, space, springs, type } from '@/theme';

import { ShieldOrb } from './visuals';

const LOCK_PAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['bio', '0', 'del'],
] as const;

type Props = {
  title: string;
  hint: string;
  pinLength: number;
  filled: number;
  message: string | null;
  /** Меняется при ошибке: запускает тряску ряда точек. */
  shakeKey: number;
  bioAvailable: boolean;
  bioLabel: string;
  deleteLabel: string;
  backLabel: string;
  onBack: () => void;
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onBiometric: () => void;
};

/** Экран PIN: тряска при ошибке, пружинные точки, стеклянная клавиатура на кинематографичном фоне. */
export function SupportLockView(props: Props) {
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!props.shakeKey) return;
    shake.value = withSequence(
      withTiming(-12, { duration: 45 }),
      withRepeat(withTiming(12, { duration: 85 }), 3, true),
      withTiming(0, { duration: 45 }),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }, [props.shakeKey, shake]);

  const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <View style={styles.screen}>
      <AnimatedBackground />
      <View style={styles.topBar}>
        <PressableScale onPress={props.onBack} accessibilityRole="button" accessibilityLabel={props.backLabel}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
      </View>

      <View style={styles.center}>
        <Animated.View entering={FadeInDown.duration(480).easing(EASE_OUT)}>
          <ShieldOrb size={116} icon="lock-closed" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(480).easing(EASE_OUT)} style={styles.copy}>
          <Text style={[type.h2, styles.centerText]}>{props.title}</Text>
          <Text style={[type.bodySm, styles.centerText]}>{props.hint}</Text>
        </Animated.View>

        <Animated.View style={[styles.dots, dotsStyle]}>
          {Array.from({ length: props.pinLength }, (_, index) => (
            <PinDot key={index} filled={index < props.filled} />
          ))}
        </Animated.View>

        <View style={styles.messageSlot}>
          {props.message ? (
            <Animated.Text entering={FadeInDown.duration(260)} style={[type.bodySm, styles.error]}>
              {props.message}
            </Animated.Text>
          ) : null}
        </View>

        <View style={styles.pad}>
          {LOCK_PAD_ROWS.map((row, rowIndex) => (
            <Animated.View key={row.join('-')} entering={FadeInDown.delay(160 + rowIndex * 60).duration(420).easing(EASE_OUT)} style={styles.padRow}>
              {row.map((key) => {
                if (key === 'bio') {
                  return props.bioAvailable ? (
                    <PadKey key="bio" icon="finger-print-outline" accessibilityLabel={props.bioLabel} onPress={props.onBiometric} />
                  ) : (
                    <View key="empty" style={styles.padEmpty} />
                  );
                }
                if (key === 'del') {
                  return <PadKey key="del" icon="backspace-outline" accessibilityLabel={props.deleteLabel} onPress={props.onDelete} />;
                }
                return <PadKey key={key} label={key} onPress={() => props.onDigit(key)} />;
              })}
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Точка PIN: при заполнении пружинно «вспыхивает». */
function PinDot({ filled }: { filled: boolean }) {
  const progress = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(filled ? 1 : 0, springs.snappy);
  }, [filled, progress]);

  const fill = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.4 + progress.value * 0.6 }],
  }));

  return (
    <View style={styles.dot}>
      <Animated.View style={[styles.dotFill, fill]} />
    </View>
  );
}

function PadKey({
  label,
  icon,
  accessibilityLabel,
  onPress,
}: {
  label?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale pressedScale={0.92} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}>
      <View style={styles.padKey}>
        {icon ? <Ionicons name={icon} size={24} color={colors.text} /> : <Text style={type.h2}>{label}</Text>}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: space.xl, paddingVertical: space.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md },
  copy: { alignItems: 'center', gap: space.xs },
  centerText: { textAlign: 'center' },
  dots: { flexDirection: 'row', gap: space.lg, marginTop: space.md },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFill: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accentBright },
  messageSlot: { minHeight: 22, alignItems: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
  pad: { gap: space.md, marginTop: space.sm },
  padRow: { flexDirection: 'row', gap: space.lg, justifyContent: 'center' },
  padKey: {
    width: 74,
    height: 74,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,241,234,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  padEmpty: { width: 74, height: 74 },
});
