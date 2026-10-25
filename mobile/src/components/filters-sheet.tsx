import { Ionicons } from '@expo/vector-icons';
import { GlassBackdrop } from '@/components/ui/glass-backdrop';
import * as Haptics from 'expo-haptics';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, SlideInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';
import { colors, fill, fonts, radius, space, type } from '@/theme';

export type FilterOption = { key: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  showLabel: string;
  resetLabel: string;
  styleLabel: string;
  levelLabel: string;
  styles: FilterOption[];
  levels: FilterOption[];
  selectedStyle: string | null;
  selectedLevel: string | null;
  onSelectStyle: (key: string | null) => void;
  onSelectLevel: (key: string | null) => void;
  onReset: () => void;
  onClose: () => void;
};

/** Шторка фильтров: выезжает пружиной, фон размыт, выбранные чипы отмечены галочкой. */
export function FiltersSheet(props: Props) {
  const insets = useSafeAreaInsets();
  const { selectedStyle, selectedLevel } = props;
  const active = (selectedStyle ? 1 : 0) + (selectedLevel ? 1 : 0);

  return (
    <Modal visible={props.visible} animationType="fade" transparent onRequestClose={props.onClose} statusBarTranslucent>
      <View style={sheet.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel={catalogFor(deviceLocale(undefined)).common.actions.close}
        >
          <GlassBackdrop intensity={25} />
          <View style={sheet.backdrop} />
        </Pressable>

        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(180)} style={[sheet.panel, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={sheet.handle} />
          <View style={sheet.topRow}>
            <Text style={sheet.title}>{props.title}</Text>
            {active > 0 ? (
              <Pressable onPress={props.onReset} hitSlop={12} accessibilityRole="button">
                <Animated.Text entering={FadeIn} style={sheet.reset}>
                  {props.resetLabel}
                </Animated.Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sheet.body}>
            <Text style={type.eyebrow}>{props.styleLabel}</Text>
            <View style={sheet.grid}>
              {props.styles.map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  active={selectedStyle === opt.key}
                  onPress={() => props.onSelectStyle(selectedStyle === opt.key ? null : opt.key)}
                />
              ))}
            </View>

            <Text style={[type.eyebrow, sheet.sectionGap]}>{props.levelLabel}</Text>
            <View style={sheet.grid}>
              {props.levels.map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  active={selectedLevel === opt.key}
                  onPress={() => props.onSelectLevel(selectedLevel === opt.key ? null : opt.key)}
                />
              ))}
            </View>
          </ScrollView>

          <Button label={`${props.showLabel}${active > 0 ? ` · ${active}` : ''}`} onPress={props.onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Animated.View layout={LinearTransition.springify().damping(18)}>
      <PressableScale
        haptic={false}
        style={[sheet.chip, active && sheet.chipActive]}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onPress();
        }}
        accessibilityState={{ selected: active }}
      >
        {active ? (
          <Animated.View entering={ZoomIn.duration(180)}>
            <Ionicons name="checkmark" size={15} color={colors.white} />
          </Animated.View>
        ) : null}
        <Text style={[sheet.chipText, active && sheet.chipTextActive]}>{label}</Text>
      </PressableScale>
    </Animated.View>
  );
}

const sheet = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...fill, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    maxHeight: '88%',
    paddingTop: 10,
    paddingHorizontal: space.xl,
    gap: space.lg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  reset: { fontSize: 14, fontWeight: '700', color: colors.accentText },
  body: { gap: space.md, paddingBottom: space.sm },
  sectionGap: { marginTop: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accentBright },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextActive: { color: colors.white },
});
