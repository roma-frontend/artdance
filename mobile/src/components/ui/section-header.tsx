import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/theme';
import { PressableScale } from './pressable-scale';

type Props = {
  eyebrow?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Заголовок секции: золотой надзаголовок, крупный заголовок и «Смотреть все». */
export function SectionHeader({ eyebrow, title, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        {eyebrow ? <Text style={type.eyebrow}>{eyebrow}</Text> : null}
        <Text style={type.h2} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} hitSlop={10} style={styles.action} accessibilityRole="link">
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.text2} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.xl },
  text: { flex: 1, gap: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 4 },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
});
