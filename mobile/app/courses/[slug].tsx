import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { payMyOrder } from '@/lib/checkout';
import { useEntitlements } from '@/lib/entitlements';
import { levelLabel, plural, price, styleLabel } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enrollInCourse, getCourse, type CourseDetail } from '@/lib/courses';
import { openPaymentUrl } from '@/lib/payment-url';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/**
 * Карточка курса. Программа показывается без видео: ключи файлов сервер не отдаёт,
 * смотреть можно только после записи и подтверждённой оплаты.
 */
export default function CourseDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const t = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const entitlements = useEntitlements();
  const enabled = entitlements?.courses === true;
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      setCourse(await getCourse(slug, locale));
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, [slug, locale, t.catalogError]);

  useFocusEffect(
    useCallback(() => {
      if (enabled) void load();
    }, [enabled, load]),
  );

  async function onEnroll() {
    if (!course || paying) return;
    setPaying(true);
    try {
      const order = await enrollInCourse(course.slug);
      const { redirectUrl } = await payMyOrder(order.id, 'CARD', locale);
      if (!(await openPaymentUrl(redirectUrl))) Alert.alert(t.bookPayFailed);
    } catch (error) {
      Alert.alert(serverMessageOf(error) ?? t.bookPayFailed);
    } finally {
      setPaying(false);
    }
  }

  if (entitlements === null) return null;
  if (!enabled) return <Redirect href="/" />;

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => goBack('/courses')} accessibilityRole="button" accessibilityLabel={backLabel()}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={[type.h2, styles.headerTitle]} numberOfLines={2}>
        {course?.title ?? c.courses.title}
      </Text>
    </Animated.View>
  );

  if (course === null) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        {failed === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accentBright} />
          </View>
        ) : (
          <EmptyState icon="alert-circle-outline" title={failed} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={type.bodySm}>{course.instructor.name}</Text>
          <Text style={styles.meta}>
            {styleLabel(course.style, c)} · {levelLabel(course.level, c)}
          </Text>
          <Text style={type.bodySm}>{course.description}</Text>
          <Text style={type.bodySm}>{c.courses.totalDuration.replace('{duration}', `${course.totalMinutes} min`)}</Text>
        </View>

        {course.requirements.length > 0 ? (
          <View style={styles.card}>
            <Text style={type.h3}>{c.courses.requirementsTitle}</Text>
            {course.requirements.map((item, index) => (
              <Text key={`${index}-${item}`} style={type.bodySm}>
                • {item}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={type.h3}>{c.courses.curriculumTitle}</Text>
          {course.lessons.map((lesson) => (
            <View key={lesson.id} style={styles.row}>
              <Text style={[type.bodySm, styles.grow]} numberOfLines={2}>
                {lesson.title}
              </Text>
              <Text style={type.label}>{lesson.durationMinutes} min</Text>
            </View>
          ))}
          <Text style={type.bodySm}>{plural(c.courses.lessonsCount, course.lessonsCount, locale)}</Text>
        </View>

        <View style={styles.card}>
          {course.enrolled ? (
            <Text style={styles.meta}>{c.courses.enrolledBadge}</Text>
          ) : (
            <View style={styles.row}>
              <Text style={[type.h3, styles.grow]}>{price(course.price, locale)}</Text>
              <Button label={c.courses.enrollCta} onPress={onEnroll} busy={paying} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  headerTitle: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  meta: { fontSize: 12, fontWeight: '700', color: colors.metal },
});
