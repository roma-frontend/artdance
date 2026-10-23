import { BlurView } from 'expo-blur';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/animated-background';
import { BrandLogo } from '@/components/brand-logo';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';
import { colors, radius, space, type } from '@/theme';
import { AuthSegment } from './auth-segment';

type Props = {
  mode: 'sign-in' | 'sign-up';
  title: string;
  signInLabel: string;
  signUpLabel: string;
  switchHref: '/sign-in' | '/sign-up';
  switchLabel: string;
  shake: SharedValue<number>;
  children: ReactNode;
};

/** Общий каркас входа и регистрации: живой фон, знак бренда, стеклянная карточка формы. */
export function AuthLayout({ mode, title, signInLabel, signUpLabel, switchHref, switchLabel, shake, children }: Props) {
  const insets = useSafeAreaInsets();
  const t = catalogFor(deviceLocale(undefined));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <View style={styles.screen}>
      <AnimatedBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(700)} style={styles.brand}>
            <BrandLogo width={240} />
            <Text style={styles.tagline}>{t.brand.tagline}</Text>
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(100).duration(700)} style={styles.title}>
            {title}
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(160).duration(700)}>
            <AuthSegment active={mode} signInLabel={signInLabel} signUpLabel={signUpLabel} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(220).duration(700)}>
            <Animated.View style={[styles.card, cardStyle]}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.cardInner}>{children}</View>
            </Animated.View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(420).duration(600)}>
            <Link href={switchHref} replace style={styles.link}>
              {switchLabel}
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.xxl, gap: space.xl },
  brand: { alignItems: 'center', gap: 6, marginBottom: space.sm },
  tagline: { ...type.eyebrow, color: colors.metal },
  title: { ...type.h2, textAlign: 'center' },
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  cardInner: { padding: space.xl, gap: space.md, backgroundColor: 'rgba(20,10,14,0.45)' },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: colors.text2 },
});
