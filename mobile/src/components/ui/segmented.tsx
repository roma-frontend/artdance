import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, radius, springs } from '@/theme';

type Option<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  options: readonly Option<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Лента чипов с прокруткой вместо равных сегментов. */
  scrollable?: boolean;
};

/** Переключатель с «перетекающей» подложкой: она пружинит к выбранному пункту, как в iOS и Revolut. */
export function Segmented<K extends string>({ options, value, onChange, scrollable }: Props<K>) {
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const ready = useSharedValue(0);

  useEffect(() => {
    const layout = layouts[value];
    if (!layout) return;
    if (ready.value === 0) {
      x.value = layout.x;
      width.value = layout.width;
      ready.value = 1;
      return;
    }
    x.value = withSpring(layout.x, springs.snappy);
    width.value = withSpring(layout.width, springs.snappy);
  }, [layouts, value, x, width, ready]);

  const indicator = useAnimatedStyle(() => ({
    opacity: ready.value,
    width: width.value,
    transform: [{ translateX: x.value }],
  }));

  const onLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x: lx, width: lw } = event.nativeEvent.layout;
    setLayouts((prev) => (prev[key]?.x === lx && prev[key]?.width === lw ? prev : { ...prev, [key]: { x: lx, width: lw } }));
  };

  const items = (
    <View style={[styles.track, scrollable ? styles.trackScroll : styles.trackFill]}>
      <Animated.View style={[styles.indicator, indicator]} />
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onLayout={onLayout(option.key)}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => undefined);
              onChange(option.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.item, !scrollable && styles.itemFill]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return items;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {items}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245,241,234,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  trackFill: { alignSelf: 'stretch' },
  trackScroll: { alignSelf: 'flex-start' },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  item: { paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  itemFill: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text2 },
  labelActive: { color: colors.bg },
});
