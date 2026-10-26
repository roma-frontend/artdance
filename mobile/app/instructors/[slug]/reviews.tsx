import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { listInstructorReviews, type InstructorReview, type InstructorReviews } from '@/lib/instructor-reviews';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { EASE_OUT, enterItem } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/** Одобренные отзывы инструктора. Как на вебе: тумблера нет, отзывы открыты всем. */
export default function InstructorReviewsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const t = messagesFor(locale);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<InstructorReview>>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InstructorReviews | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setFailed(null);
    listInstructorReviews(slug, page)
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((error: unknown) => {
        if (alive) setFailed(serverMessageOf(error) ?? t.catalogError);
      });
    return () => {
      alive = false;
    };
  }, [slug, page, t.catalogError]);

  function goToPage(next: number) {
    setPage(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={[type.h2, styles.headerTitle]} numberOfLines={2}>
        {c.footer.instructorReviewsTitle.replace('{slug}', slug)}
      </Text>
    </Animated.View>
  );

  if (data === null) {
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

  const totalPages = data.totalPages;
  const summary =
    data.rating.count > 0
      ? c.reviews.averageOf
          .replace('{rating}', data.rating.average.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
          .replace('{max}', '5')
      : c.reviews.notEnough;

  const pager =
    totalPages > 1 ? (
      <View style={styles.pager}>
        {page > 1 ? (
          <Button label={c.footer.reviewsPrev} variant="ghost" style={styles.pagerButton} onPress={() => goToPage(page - 1)} />
        ) : (
          <View style={styles.pagerButton} />
        )}
        <Text style={type.bodySm}>{c.footer.reviewsPage.replace('{page}', String(page)).replace('{total}', String(totalPages))}</Text>
        {page < totalPages ? (
          <Button label={c.footer.reviewsNext} variant="ghost" style={styles.pagerButton} onPress={() => goToPage(page + 1)} />
        ) : (
          <View style={styles.pagerButton} />
        )}
      </View>
    ) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <FlatList
        ref={listRef}
        data={data.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Text style={type.h3}>{summary}</Text>}
        ListEmptyComponent={<EmptyState icon="chatbubble-outline" title={c.reviews.empty} body={c.reviews.emptyHint} />}
        ListFooterComponent={pager ?? undefined}
        renderItem={({ item, index }) => (
          <Animated.View entering={enterItem(index)} style={styles.card}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Ionicons key={value} name={value <= item.rating ? 'star' : 'star-outline'} size={16} color={colors.accentBright} />
              ))}
            </View>
            <Text style={type.label}>{item.authorName}</Text>
            {item.authorRole ? <Text style={type.bodySm}>{item.authorRole}</Text> : null}
            {item.isVerifiedPurchase ? <Text style={styles.badge}>{c.reviews.verifiedBadge}</Text> : null}
            <Text style={type.body}>{item.body}</Text>
          </Animated.View>
        )}
      />
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
  stars: { flexDirection: 'row', gap: space.xs },
  badge: { fontSize: 12, fontWeight: '700', color: colors.metal },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginTop: space.md },
  pagerButton: { flex: 1 },
});
