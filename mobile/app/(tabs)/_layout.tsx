import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarHidden } from '@/lib/tab-bar';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors, fill, springs } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  classes: ['musical-notes-outline', 'musical-notes'],
  events: ['sparkles-outline', 'sparkles'],
  shop: ['bag-handle-outline', 'bag-handle'],
  account: ['person-circle-outline', 'person-circle'],
};

export default function TabsLayout() {
  const t = messagesFor(deviceLocale(undefined));
  const titles: Record<string, string> = {
    index: t.tabHome,
    classes: t.tabClasses,
    events: t.tabEvents,
    shop: t.tabShop,
    account: t.tabAccount,
  };

  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {Object.keys(ICONS).map((name) => (
        <Tabs.Screen key={name} name={name} options={{ title: titles[name] }} />
      ))}
    </Tabs>
  );
}

const BAR_HEIGHT = 66;
const SIDE = 16;
const liquidGlass = isLiquidGlassAvailable();

/**
 * Плавающая стеклянная капсула: подсветка «перетекает» к активной вкладке,
 * иконка подпрыгивает, а при прокрутке вниз капсула уезжает за край экрана.
 */
function GlassTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const itemWidth = width / Math.max(count, 1);
  const x = useSharedValue(0);
  const barRef = useRef<ComponentRef<typeof View>>(null);
  const barPageX = useRef(0);
  const dragIndex = useRef<number | null>(null);
  const pressed = useSharedValue(0);

  useEffect(() => {
    if (itemWidth > 0) x.value = withSpring(state.index * itemWidth, springs.snappy);
  }, [state.index, itemWidth, x]);

  const panHandlers = useMemo(() => {
    const indexAt = (pageX: number) =>
      Math.min(Math.max(Math.floor((pageX - barPageX.current) / Math.max(itemWidth, 1)), 0), count - 1);

    const settle = (index: number) => {
      dragIndex.current = null;
      pressed.value = withSpring(0, springs.snappy);
      let target = state.index;
      if (index !== state.index) {
        const event = emitter.emit({ type: 'tabPress', target: state.routes[index].key, canPreventDefault: true });
        if (!event.defaultPrevented) {
          target = index;
          tabBarHidden.value = 0;
          navigateToTab(state.routes[index].key);
        }
      }
      x.value = withSpring(target * itemWidth, springs.snappy);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragIndex.current = state.index;
        pressed.value = withSpring(1, springs.snappy);
      },
      onPanResponderMove: (e) => {
        const finger = e.nativeEvent.pageX - barPageX.current;
        const index = indexAt(e.nativeEvent.pageX);
        if (index !== dragIndex.current) {
          dragIndex.current = index;
          Haptics.selectionAsync().catch(() => undefined);
        }
        x.value = Math.min(Math.max(finger - itemWidth / 2, 0), (count - 1) * itemWidth);
      },
      onPanResponderRelease: () => settle(dragIndex.current ?? state.index),
      onPanResponderTerminate: () => settle(dragIndex.current ?? state.index),
    }).panHandlers;
  }, [count, emitter, itemWidth, navigateToTab, pressed, state.index, state.routes, x]);

  const blob = useAnimatedStyle(() => ({ width: itemWidth, transform: [{ translateX: x.value }] }));
  const blobInner = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + pressed.value * 0.06 }, { scaleY: 1 + pressed.value * 0.08 }],
  }));

  const hidden = useDerivedValue(() => withTiming(tabBarHidden.value, { duration: 320, easing: Easing.out(Easing.cubic) }));
  const hide = useAnimatedStyle(() => ({
    opacity: 1 - hidden.value * 0.9,
    transform: [{ translateY: hidden.value * (BAR_HEIGHT + insets.bottom + 24) }],
  }));

  return (
    <Animated.View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }, hide]} pointerEvents="box-none">
      <View
        ref={barRef}
        style={styles.bar}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          barRef.current?.measure((_x, _y, _w, _h, pageX) => {
            barPageX.current = pageX;
          });
        }}
        {...panHandlers}
      >
        {liquidGlass ? (
          <GlassView glassEffectStyle="regular" isInteractive style={StyleSheet.absoluteFill} />
        ) : (
          <>
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.tint} />
          </>
        )}
        {width > 0 ? (
          <Animated.View style={[styles.blobTrack, blob]} pointerEvents="none">
            <Animated.View style={[styles.blob, blobInner]} />
          </Animated.View>
        ) : null}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const [icon, iconActive] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const label = descriptors[route.key]?.options.title ?? route.name;
          return (
            <TabItem
              key={route.key}
              label={label}
              icon={focused ? iconActive : icon}
              focused={focused}
              index={index}
              itemWidth={itemWidth}
              blobX={x}
              drag={pressed}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                Haptics.selectionAsync().catch(() => undefined);
                tabBarHidden.value = 0;
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

function TabItem({
  label,
  icon,
  focused,
  onPress,
  index,
  itemWidth,
  blobX,
  drag,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
  index: number;
  itemWidth: number;
  blobX: SharedValue<number>;
  drag: SharedValue<number>;
}) {
  const bounce = useSharedValue(1);
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, springs.snappy);
    if (focused) bounce.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 8, stiffness: 300 }));
  }, [focused, bounce, lift]);

  const iconStyle = useAnimatedStyle(() => {
    const near = drag.value * Math.max(0, 1 - Math.abs(blobX.value - index * itemWidth) / Math.max(itemWidth, 1));
    return { transform: [{ scale: bounce.value * (1 + near * 0.16) }, { translateY: -lift.value * 1.5 - near * 2 }] };
  });
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.55 + lift.value * 0.45 }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={iconStyle}>
        <Ionicons name={icon} size={23} color={focused ? colors.text : colors.text3} />
      </Animated.View>
      <Animated.Text
        style={[styles.label, { color: focused ? colors.text : colors.text3 }, labelStyle]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: SIDE, right: SIDE },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: 'rgba(20,16,18,0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  tint: { ...fill, backgroundColor: 'rgba(14,10,12,0.5)' },
  blobTrack: { position: 'absolute', top: 0, bottom: 0, left: 0, padding: 6 },
  blob: {
    flex: 1,
    borderRadius: (BAR_HEIGHT - 12) / 2,
    backgroundColor: 'rgba(201,59,82,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,59,82,0.45)',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.1 },
});
