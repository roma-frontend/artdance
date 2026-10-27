import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getAbout, type AboutContent } from '@/lib/content';
import { openLandingWebPath } from '@/lib/web-links';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

export default function AboutScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useCachedState<AboutContent>('content.about', 'public');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getAbout(locale)
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

  function openWeb(path: string) {
    if (path === '/classes') {
      router.push({ pathname: '/catalog/[section]', params: { section: 'classes' } });
      return;
    }
    if (path === '/become-instructor') {
      router.push('/become-instructor');
      return;
    }
    openLandingWebPath(locale, path);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.footer.about}</Text>
      </Animated.View>

      {content === null ? (
        <EmptyState icon="alert-circle-outline" title={t.catalogError} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <Text style={type.bodySm}>{content.subtitle}</Text>

          <Animated.View entering={enterItem(0)} style={styles.card}>
            <Text style={type.h3}>{content.mission.title}</Text>
            <Text style={type.bodySm}>{content.mission.body}</Text>
          </Animated.View>

          <Text style={type.h3}>{content.values.title}</Text>
          {content.values.items.map((value, index) => (
            <Animated.View key={value.id} entering={enterItem(index + 1)} style={styles.card}>
              <Text style={type.h3}>{value.title}</Text>
              <Text style={type.bodySm}>{value.body}</Text>
            </Animated.View>
          ))}

          <Animated.View entering={enterItem(content.values.items.length + 1)} style={styles.card}>
            <Text style={type.h3}>{content.story.title}</Text>
            <Text style={type.bodySm}>{content.story.body}</Text>
          </Animated.View>

          <Animated.View entering={enterItem(content.values.items.length + 2)} style={styles.card}>
            <Text style={type.h3}>{content.cta.title}</Text>
            <Text style={type.bodySm}>{content.cta.subtitle}</Text>
            <PressableScale onPress={() => openWeb(content.cta.primaryPath)} accessibilityRole="button">
              <Text style={[type.label, styles.cta]}>{content.cta.primary}</Text>
            </PressableScale>
            <PressableScale onPress={() => openWeb(content.cta.secondaryPath)} accessibilityRole="button">
              <Text style={[type.label, styles.cta]}>{content.cta.secondary}</Text>
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
  cta: { color: colors.accentBright, marginTop: space.xs },
});
