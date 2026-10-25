import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getHelp, type HelpContent, type HelpTopic } from '@/lib/content';
import { webUrl } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/** Разделы справки, которые открываются экраном приложения; остальные ведут на сайт. */
const NATIVE_PATHS: ReadonlySet<string> = new Set(['/faq']);

export default function HelpScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<HelpContent | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getHelp(locale)
      .then((next) => {
        if (alive) setContent(next);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  if (content === null && !failed) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  function openTopic(topic: HelpTopic) {
    if (NATIVE_PATHS.has(topic.path)) {
      router.push(topic.path as '/faq');
      return;
    }
    const path = topic.anchor ? `${topic.path}#${topic.anchor}` : topic.path;
    Linking.openURL(webUrl(locale, path)).catch(() => undefined);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.footer.help}</Text>
      </Animated.View>

      {content === null ? (
        <EmptyState icon="alert-circle-outline" title={t.catalogError} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <Text style={type.bodySm}>{content.subtitle}</Text>

          {content.topics.map((topic, index) => (
            <Animated.View key={topic.id} entering={enterItem(index)}>
              <PressableScale onPress={() => openTopic(topic)} accessibilityRole="button" style={styles.card}>
                <Text style={type.h3}>{topic.title}</Text>
                <Text style={type.bodySm}>{topic.body}</Text>
                <Text style={[type.label, styles.cta]}>{topic.cta}</Text>
              </PressableScale>
            </Animated.View>
          ))}

          <Animated.View entering={enterItem(content.topics.length)} style={styles.card}>
            <Text style={type.h3}>{content.stillStuck.title}</Text>
            <Text style={type.bodySm}>{content.stillStuck.body}</Text>
            <PressableScale
              onPress={() => Linking.openURL(webUrl(locale, content.stillStuck.path)).catch(() => undefined)}
              accessibilityRole="button"
            >
              <Text style={[type.label, styles.cta]}>{content.stillStuck.cta}</Text>
            </PressableScale>
          </Animated.View>
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
  cta: { color: colors.accentText, marginTop: space.xs },
});
