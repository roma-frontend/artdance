import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getGiftCards, type GiftCardsContent } from '@/lib/content';
import { serverMessageOf } from '@/lib/server-message';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

export default function GiftCardsScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<GiftCardsContent | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getGiftCards(locale)
      .then((next) => {
        if (alive) setContent(next);
      })
      .catch((error: unknown) => {
        if (alive) setFailed(serverMessageOf(error) ?? t.catalogError);
      });
    return () => {
      alive = false;
    };
  }, [locale, t.catalogError]);

  if (content === null && failed === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  function openPath(path: string) {
    if (path === '/shop/gift-card') {
      router.push({ pathname: '/catalog/[section]/[slug]', params: { section: 'shop', slug: 'gift-card' } });
      return;
    }
    if (path.startsWith('/legal/')) {
      router.push({ pathname: '/legal', params: { slug: path.slice('/legal/'.length) } });
      return;
    }
    router.push('/contact');
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.footer.giftCards}</Text>
      </Animated.View>

      {content === null ? (
        <EmptyState icon="alert-circle-outline" title={failed ?? t.catalogError} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <Text style={type.bodySm}>{content.subtitle}</Text>

          <Animated.View entering={enterItem(0)} style={styles.card}>
            <Text style={type.h3}>{content.amounts.title}</Text>
            <Text style={type.bodySm}>{content.amounts.note}</Text>
            <View style={styles.chips}>
              {content.amounts.presets.map((preset) => (
                <View key={preset.amount} style={styles.chip}>
                  <Text style={type.label}>{preset.label}</Text>
                </View>
              ))}
            </View>
            <Text style={type.caption}>{content.amounts.validity}</Text>
          </Animated.View>

          <View style={styles.card}>
            <Text style={type.h3}>{c.footer.redeemGiftCard}</Text>
            <Text style={type.bodySm}>{c.footer.activateHint}</Text>
            <PressableScale onPress={() => router.push('/gift-cards/redeem')} accessibilityRole="button">
              <Text style={[type.label, styles.cta]}>{c.footer.redeemCta}</Text>
            </PressableScale>
          </View>

          <Text style={type.h3}>{content.steps.title}</Text>
          {content.steps.items.map((step, i) => (
            <Animated.View key={step.id} entering={enterItem(i + 1)} style={styles.card}>
              <Text style={type.title}>{step.title}</Text>
              <Text style={type.bodySm}>{step.body}</Text>
            </Animated.View>
          ))}

          <View style={styles.card}>
            <Text style={type.h3}>{content.terms.title}</Text>
            {content.terms.items.map((term) => (
              <Text key={term.id} style={type.bodySm}>
                {term.text}
              </Text>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={type.h3}>{content.cta.title}</Text>
            <Text style={type.bodySm}>{content.cta.subtitle}</Text>
            <PressableScale onPress={() => openPath(content.cta.primaryPath)} accessibilityRole="button">
              <Text style={[type.label, styles.cta]}>{content.cta.primary}</Text>
            </PressableScale>
            <PressableScale onPress={() => openPath(content.cta.secondaryPath)} accessibilityRole="button">
              <Text style={[type.label, styles.cta]}>{content.cta.secondary}</Text>
            </PressableScale>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cta: { color: colors.accentBright, marginTop: space.xs },
});
