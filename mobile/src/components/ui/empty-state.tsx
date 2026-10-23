import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, space, type } from '@/theme';
import { Button } from './button';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Пустое состояние или ошибка: иконка в мягком круге, текст и действие. */
export function EmptyState({ icon, title, body, actionLabel, onAction }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.wrap}>
      <View style={styles.halo}>
        <Ionicons name={icon} size={30} color={colors.accentBright} />
      </View>
      <Text style={[type.h3, styles.center]}>{title}</Text>
      {body ? <Text style={[type.bodySm, styles.center]}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="ghost" style={styles.action} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md, paddingVertical: 48, paddingHorizontal: space.xxl },
  halo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
  action: { marginTop: 8, alignSelf: 'center' },
});
