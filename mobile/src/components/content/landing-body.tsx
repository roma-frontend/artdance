import { useRouter } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import type { BecomeInstructorContent } from '@/lib/content';
import { openLandingWebPath } from '@/lib/web-links';
import type { Locale } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/** Общий экран лендинга: преподаватели и площадки имеют одинаковый состав. */
export function LandingBody({ content, locale }: { content: BecomeInstructorContent; locale: Locale }) {
  const router = useRouter();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const earningsY = useRef(0);

  function openPath(path: string) {
    if (path.startsWith('/legal/')) {
      router.push({ pathname: '/legal', params: { slug: path.slice('/legal/'.length) } });
      return;
    }
    openLandingWebPath(locale, path);
  }

  function scrollToEarnings() {
    scrollRef.current?.scrollTo({ y: earningsY.current, animated: true });
  }

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      <Text style={type.caption}>{content.eyebrow}</Text>
      <Text style={type.h2}>{content.title}</Text>
      <Text style={type.bodySm}>{content.subtitle}</Text>
      <View style={styles.actions}>
        <PressableScale onPress={() => router.push('/contact')} accessibilityRole="button">
          <Text style={[type.label, styles.cta]}>{content.primaryCta}</Text>
        </PressableScale>
        <PressableScale onPress={scrollToEarnings} accessibilityRole="button">
          <Text style={[type.label, styles.cta]}>{content.secondaryCta}</Text>
        </PressableScale>
      </View>

      <Text style={type.h3}>{content.benefits.title}</Text>
      {content.benefits.items.map((item, index) => (
        <Animated.View key={item.id} entering={enterItem(index)} style={styles.card}>
          <Text style={type.title}>{item.title}</Text>
          <Text style={type.bodySm}>{item.body}</Text>
        </Animated.View>
      ))}

      <Text style={type.h3}>{content.steps.title}</Text>
      {content.steps.items.map((step, index) => (
        <Animated.View key={step.id} entering={enterItem(index)} style={styles.card}>
          <Text style={type.title}>{step.title}</Text>
          <Text style={type.bodySm}>{step.body}</Text>
        </Animated.View>
      ))}

      <Animated.View
        entering={FadeInDown.duration(420).easing(EASE_OUT)}
        style={styles.card}
        onLayout={(e) => {
          earningsY.current = e.nativeEvent.layout.y;
        }}
      >
        <Text style={type.h3}>{content.earnings.title}</Text>
        <Text style={type.bodySm}>{content.earnings.body}</Text>
        {content.earnings.items.map((fact) => (
          <Text key={fact.id} style={type.bodySm}>
            {fact.text}
          </Text>
        ))}
      </Animated.View>

      <Animated.View entering={enterItem(1)} style={styles.card}>
        <Text style={type.h3}>{content.requirements.title}</Text>
        {content.requirements.items.map((fact) => (
          <Text key={fact.id} style={type.bodySm}>
            {fact.text}
          </Text>
        ))}
      </Animated.View>

      <Animated.View entering={enterItem(2)} style={styles.card}>
        <Text style={type.h3}>{content.cta.title}</Text>
        <Text style={type.bodySm}>{content.cta.subtitle}</Text>
        <PressableScale onPress={() => router.push('/contact')} accessibilityRole="button">
          <Text style={[type.label, styles.cta]}>{content.cta.primary}</Text>
        </PressableScale>
        <PressableScale onPress={() => openPath(content.cta.secondaryPath)} accessibilityRole="button">
          <Text style={[type.label, styles.cta]}>{content.cta.secondary}</Text>
        </PressableScale>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  cta: { color: colors.accentText, marginTop: space.xs },
});
