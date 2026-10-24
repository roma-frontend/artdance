import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { getLegalDocument, getLegalIndex, type LegalDocumentContent, type LegalIndexContent } from '@/lib/content';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/**
 * Правовые документы. Без параметра `slug` — список, с параметром — текст документа.
 * Назад из документа ведёт к списку, потому что это тот же экран с другим параметром.
 */
export default function LegalScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState<LegalIndexContent | null>(null);
  const [doc, setDoc] = useState<LegalDocumentContent | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    const request = slug
      ? getLegalDocument(locale, slug).then((next) => {
          if (alive) setDoc(next);
        })
      : getLegalIndex(locale).then((next) => {
          if (alive) setIndex(next);
        });
    request.catch(() => {
      if (alive) setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [locale, slug]);

  const loaded = slug ? doc : index;
  const title = slug ? doc?.title : index?.title;

  if (loaded === null && !failed) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {title ?? ''}
        </Text>
      </Animated.View>

      {loaded === null ? (
        <EmptyState icon="alert-circle-outline" title={t.catalogError} />
      ) : slug && doc ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <Text style={type.caption}>{doc.lastUpdated}</Text>
          {doc.draftNotice && (
            <View style={styles.card}>
              <Text style={type.bodySm}>{doc.draftNotice}</Text>
            </View>
          )}
          <Text style={type.bodySm}>{doc.intro}</Text>

          {doc.sections.map((section, i) => (
            <Animated.View key={section.id} entering={enterItem(i)} style={styles.card}>
              <Text style={type.h3}>{section.title}</Text>
              <Text style={type.bodySm}>{section.body}</Text>
            </Animated.View>
          ))}

          <Text style={type.caption}>{doc.versionNote}</Text>
          <Text style={type.caption}>{doc.contactNote}</Text>
        </ScrollView>
      ) : index ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {index.documents.map((item, i) => (
            <Animated.View key={item.id} entering={enterItem(i)}>
              <PressableScale onPress={() => router.push({ pathname: '/legal', params: { slug: item.slug } })} accessibilityRole="button">
                <View style={styles.card}>
                  <Text style={type.h3}>{item.title}</Text>
                  <Text style={type.caption}>{item.version}</Text>
                </View>
              </PressableScale>
            </Animated.View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  title: { flex: 1 },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
});
