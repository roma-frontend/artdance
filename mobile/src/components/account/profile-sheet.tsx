import { Ionicons } from '@expo/vector-icons';
import { GlassBackdrop } from '@/components/ui/glass-backdrop';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { deviceLocale, messagesFor, type Messages } from '@/lib/i18n';
import { colors, radius, space, type } from '@/theme';

export type ProfileField = 'name' | 'password' | 'photo' | 'email';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Item = { key: ProfileField; icon: IconName; title: string; hint: string; editable: boolean; soon: boolean };

function itemsFor(t: Messages): Item[] {
  return [
    { key: 'name', icon: 'person-outline', title: t.name, hint: t.profileNameHint, editable: true, soon: false },
    { key: 'password', icon: 'lock-closed-outline', title: t.profilePasswordTitle, hint: t.profilePasswordHint, editable: true, soon: false },
    { key: 'photo', icon: 'camera-outline', title: t.profilePhotoTitle, hint: t.profilePhotoHint, editable: true, soon: false },
    { key: 'email', icon: 'mail-outline', title: t.email, hint: t.profileEmailHint, editable: false, soon: false },
  ];
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (field: ProfileField) => void;
};

/** Шторка по долгому нажатию на профиль: показывает, какие поля можно менять в приложении. */
export function ProfileSheet({ visible, onClose, onPick }: Props) {
  const t = messagesFor(deviceLocale(undefined));
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t.accountCancel}>
          <GlassBackdrop intensity={25} />
          <View style={styles.backdrop} />
        </Pressable>

        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(180)} style={[styles.panel, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.handle} />
          <Text style={type.h3}>{t.profileActionsTitle}</Text>

          {itemsFor(t).map((item, index) => (
            <Animated.View key={item.key} entering={FadeInDown.delay(80 + index * 60).duration(380)}>
              <PressableScale
                disabled={!item.editable}
                haptic={item.editable}
                pressedScale={0.98}
                onPress={() => onPick(item.key)}
                accessibilityRole="button"
                accessibilityState={{ disabled: !item.editable }}
                style={styles.row}
              >
                <View style={[styles.icon, item.editable ? styles.iconOn : styles.iconOff]}>
                  <Ionicons name={item.icon} size={18} color={item.editable ? colors.accentBright : colors.text3} />
                </View>
                <View style={styles.flex}>
                  <Text style={[type.label, !item.editable && styles.muted]}>{item.title}</Text>
                  <Text style={styles.hint}>{item.hint}</Text>
                </View>
                <View style={[styles.badge, item.editable ? styles.badgeOn : styles.badgeOff]}>
                  <Ionicons name={item.editable ? 'checkmark' : 'lock-closed'} size={11} color={item.editable ? colors.metal : colors.text3} />
                  <Text style={[styles.badgeText, { color: item.editable ? colors.metal : colors.text3 }]}>
                    {item.editable ? t.profileEditable : item.soon ? t.profileSoon : t.profileLocked}
                  </Text>
                </View>
              </PressableScale>
            </Animated.View>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,8,9,0.55)' },
  panel: {
    backgroundColor: 'rgba(20,16,18,0.96)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,241,234,0.2)', marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(245,241,234,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: 'rgba(201,59,82,0.18)' },
  iconOff: { backgroundColor: 'rgba(245,241,234,0.06)' },
  flex: { flex: 1, gap: 2 },
  muted: { color: colors.text3 },
  hint: { fontSize: 12, color: colors.text3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.pill },
  badgeOn: { backgroundColor: 'rgba(201,169,106,0.14)' },
  badgeOff: { backgroundColor: 'rgba(245,241,234,0.06)' },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
