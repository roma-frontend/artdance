import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { GlassBackdrop } from '@/components/ui/glass-backdrop';
import { tabBarCompact, tabBarHidden } from '@/lib/tab-bar';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors, fill, fonts, gradients, springs } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  classes: ['musical-notes-outline', 'musical-notes'],
  ai: ['sparkles-outline', 'sparkles'],
  shop: ['bag-handle-outline', 'bag-handle'],
  account: ['person-circle-outline', 'person-circle'],
};

export default function TabsLayout() {
  const t = messagesFor(deviceLocale(undefined));
  const titles: Record<string, string> = {
    index: t.tabHome,
    classes: t.tabClasses,
    ai: t.tabAi,
    shop: t.tabShop,
    account: t.tabAccount,
  };

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      {Object.keys(ICONS).map((name) => (
        <Tabs.Screen key={name} name={name} options={{ title: titles[name] }} />
      ))}
    </Tabs>
  );
}

const BAR_HEIGHT = 66;
const SIDE = 16;
const COMPACT_MIN = 104;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const liquidGlass = isLiquidGlassAvailable();

/**
 * Плавающая стеклянная капсула: подсветка «перетекает» к активной вкладке,
 * иконка подпрыгивает, а при прокрутке вниз капсула уезжает за край экрана.
 */
function GlassTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const itemWidth = width / Math.max(count, 1);
  const x = useSharedValue(0);
  const dragIndex = useSharedValue(-1);
  const pressed = useSharedValue(0);

  useEffect(() => {
    if (itemWidth > 0) x.value = withSpring(state.index * itemWidth, springs.snappy);
  }, [state.index, itemWidth, x]);

  const settle = useCallback(
    (index: number) => {
      tabBarCompact.value = 0;
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
    },
    [emitter, itemWidth, navigateToTab, pressed, state.index, state.routes, x],
  );
  const tick = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
  }, []);

  // Палец ведёт подсветку на UI-потоке; JS только переключает вкладку и даёт отклик.
  // Вертикальное и диагональное движение отменяет жест и остаётся прокруткой экрана.
  const currentIndex = state.index;
  const pan = usePanGesture({
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    onActivate: () => {
      if (tabBarCompact.value >= 0.5) return;
      dragIndex.value = currentIndex;
      pressed.value = withSpring(1, springs.snappy);
    },
    onUpdate: (event) => {
      if (dragIndex.value < 0) return;
      const index = Math.min(Math.max(Math.floor(event.x / Math.max(itemWidth, 1)), 0), count - 1);
      if (index !== dragIndex.value) {
        dragIndex.value = index;
        scheduleOnRN(tick);
      }
      x.value = Math.min(Math.max(event.x - itemWidth / 2, 0), (count - 1) * itemWidth);
    },
    onDeactivate: (event) => {
      if (dragIndex.value < 0) return;
      // Прерванный системой жест не переключает вкладку.
      const index = event.canceled ? currentIndex : dragIndex.value;
      dragIndex.value = -1;
      scheduleOnRN(settle, index);
    },
  });

  const blob = useAnimatedStyle(() => ({ width: itemWidth, transform: [{ translateX: x.value }] }));
  const blobInner = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + pressed.value * 0.06 }, { scaleY: 1 + pressed.value * 0.08 }],
  }));

  const hidden = useDerivedValue(() => withTiming(tabBarHidden.value, { duration: 320, easing: Easing.out(Easing.cubic) }));
  const hide = useAnimatedStyle(() => ({
    opacity: 1 - hidden.value * 0.9,
    transform: [{ translateY: hidden.value * (BAR_HEIGHT + insets.bottom + 24) }],
  }));

  const compact = useDerivedValue(() => withSpring(tabBarCompact.value, springs.gentle));
  const pillWidth = Math.min(Math.max(itemWidth * 1.5, COMPACT_MIN), width);
  const barStyle = useAnimatedStyle(() => ({
    width: width > 0 ? width + (pillWidth - width) * compact.value : undefined,
  }));
  const rowStyle = useAnimatedStyle(() => ({
    width,
    transform: [{ translateX: (pillWidth / 2 - (x.value + itemWidth / 2)) * compact.value }],
  }));

  return (
    <Animated.View
      style={[styles.wrap, { bottom: bottomInset }, hide]}
      pointerEvents="box-none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View pointerEvents="none" style={[styles.scrim, { height: BAR_HEIGHT + bottomInset + 40, bottom: -bottomInset }]}>
        <LinearGradient colors={['rgba(11,8,9,0)', 'rgba(11,8,9,0.85)']} style={fill} />
      </View>
      <GestureDetector gesture={pan}>
      <Animated.View style={[styles.bar, barStyle]}>
        {liquidGlass ? (
          <>
            <GlassView glassEffectStyle="regular" isInteractive style={StyleSheet.absoluteFill} />
            <View style={styles.glassTint} />
          </>
        ) : (
          <>
            <GlassBackdrop intensity={70} />
            <View style={styles.tint} />
          </>
        )}
        <Animated.View style={[styles.row, rowStyle]}>
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
              hero={route.name === 'ai'}
              index={index}
              itemWidth={itemWidth}
              blobX={x}
              compact={compact}
              drag={pressed}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                Haptics.selectionAsync().catch(() => undefined);
                tabBarHidden.value = 0;
                tabBarCompact.value = 0;
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
            />
          );
          })}
        </Animated.View>
      </Animated.View>
      </GestureDetector>
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
  hero,
  compact,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  hero: boolean;
  onPress: () => void;
  index: number;
  itemWidth: number;
  blobX: SharedValue<number>;
  drag: SharedValue<number>;
  compact: SharedValue<number>;
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
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.8 + lift.value * 0.2 }));
  const itemStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - compact.value * (1 - lift.value)) }));

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.item, itemStyle]}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={iconStyle}>
        {hero ? (
          <HeroIcon />
        ) : (
          <Ionicons name={icon} size={23} color={focused ? colors.text : colors.text3} />
        )}
      </Animated.View>
      <Animated.Text
        style={[styles.label, { color: focused ? colors.text : colors.text2 }, labelStyle]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

/** Вращающаяся искра с хвостом: каждая следующая отстаёт на `lag` градусов и тускнеет. */
function OrbitSpark({ orbit, lag, size, alpha }: { orbit: SharedValue<number>; lag: number; size: number; alpha: number }) {
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${orbit.value * 360 - lag}deg` }] }));
  return (
    <Animated.View style={[styles.heroOrbit, style]} pointerEvents="none">
      <View style={[styles.heroSpark, { width: size, height: size, borderRadius: size / 2, opacity: alpha }]} />
    </Animated.View>
  );
}

/** Центральная вкладка AI: живая буква A в градиентной капсуле с дыханием, орбитой, покачиванием и бликом. */
function HeroIcon() {
  const breath = useSharedValue(0);
  const orbit = useSharedValue(0);
  const wobble = useSharedValue(0);
  const glint = useSharedValue(0);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
    orbit.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false);
    ringA.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false);
    ringB.value = withDelay(1200, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
    wobble.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(-1, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }),
        withDelay(1600, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    glint.value = withRepeat(
      withSequence(withDelay(1200, withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) })), withTiming(0, { duration: 1 })),
      -1,
      false,
    );
  }, [breath, orbit, wobble, glint, ringA, ringB]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.2 + breath.value * 0.4,
    transform: [{ scale: 0.9 + breath.value * 0.2 }],
  }));
  const ringStyleA = useAnimatedStyle(() => ({
    opacity: (1 - ringA.value) * 0.8,
    transform: [{ scale: 1 + ringA.value * 0.25 }],
  }));
  const ringStyleB = useAnimatedStyle(() => ({
    opacity: (1 - ringB.value) * 0.8,
    transform: [{ scale: 1 + ringB.value * 0.25 }],
  }));
  const letter = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.07 }, { translateY: -breath.value * 1.2 }, { rotate: `${wobble.value * 9}deg` }],
  }));
  const sweep = useAnimatedStyle(() => ({
    opacity: glint.value > 0 ? 0.55 : 0,
    transform: [{ translateX: -40 + glint.value * 80 }, { rotate: '24deg' }],
  }));

  return (
    <View style={styles.heroWrap}>
      <Animated.View style={[styles.heroHalo, halo]} pointerEvents="none" />
      <Animated.View style={[styles.heroRing, ringStyleA]} pointerEvents="none" />
      <Animated.View style={[styles.heroRing, ringStyleB]} pointerEvents="none" />
      <OrbitSpark orbit={orbit} lag={0} size={5} alpha={1} />
      <OrbitSpark orbit={orbit} lag={20} size={4} alpha={0.55} />
      <OrbitSpark orbit={orbit} lag={40} size={3} alpha={0.3} />
      <View style={styles.heroDisc}>
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fill} />
        <Animated.Text style={[styles.heroLetter, letter]} allowFontScaling={false}>
          A
        </Animated.Text>
        <Animated.View style={[styles.heroSweep, sweep]} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: SIDE, right: SIDE },
  bar: {
    alignSelf: 'center',
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
  glassTint: { ...fill, backgroundColor: 'rgba(14,10,12,0.4)' },
  scrim: { position: 'absolute', left: -SIDE, right: -SIDE },
  blobTrack: { position: 'absolute', top: 1, bottom: 1, left: 0, paddingHorizontal: 4 },
  blob: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: 'rgba(201,59,82,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,59,82,0.45)',
  },
  row: { position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  heroWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  heroHalo: { position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accentBright },
  heroRing: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
  },
  heroOrbit: { position: 'absolute', width: 46, height: 46 },
  heroSpark: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.white,
    shadowColor: colors.white,
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  heroDisc: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heroLetter: { fontFamily: fonts.displayItalic, fontSize: 25, lineHeight: 30, color: colors.white, includeFontPadding: false },
  heroSweep: { position: 'absolute', top: -10, left: 14, width: 12, height: 60, backgroundColor: colors.white },
  label: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.1 },
});
