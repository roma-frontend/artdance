import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { useEntitlements } from '@/lib/entitlements';
import { levelLabel, plural, price, styleLabel } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { listCourses, type CourseCard } from '@/lib/courses';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { EASE_OUT, enterItem } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/** Каталог онлайн-курсов. Раздел выключен тумблером `courses` — экран недоступен на вебе и в приложении. */
export default function CoursesScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const t = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const entitlements = useEntitlements();
  const enabled = entitlements?.courses === true;
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    listCourses(locale)
      .then((list) => {
        if (alive) setCourses(list.items);
      })
      .catch((error: unknown) => {
        if (alive) setFailed(serverMessageOf(error) ?? t.catalogError);
      });
    return () => {
      alive = false;
    };
  }, [enabled, locale, t.catalogError]);

  if (entitlements === null) return null;
  if (!enabled) return <Redirect href="/" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <View style={styles.headerText}>
          <Text style={type.h2} numberOfLines={1}>
            {c.courses.title}
          </Text>
          <Text style={type.bodySm} numberOfLines={2}>
            {c.courses.subtitle}
          </Text>
        </View>
      </Animated.View>

      {failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : courses === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : courses.length === 0 ? (
        <EmptyState icon="school-outline" title={c.common.states.empty} />
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={enterItem(index)}>
              <PressableScale
                onPress={() => router.push({ pathname: '/courses/[slug]', params: { slug: item.slug } })}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                style={styles.card}
              >
                <Text style={type.h3} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={type.bodySm} numberOfLines={1}>
                  {item.instructor.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {styleLabel(item.style, c)} · {levelLabel(item.level, c)}
                </Text>
                <View style={styles.footer}>
                  <Text style={type.bodySm}>{plural(c.courses.lessonsCount, item.lessonsCount, locale)}</Text>
                  <Text style={type.label}>{price(item.price, locale)}</Text>
                </View>
              </PressableScale>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  headerText: { flex: 1, gap: space.xs },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  meta: { fontSize: 12, fontWeight: '700', color: colors.metal },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
});
