import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { dateLabel } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import {
  deleteReviewReply,
  listStudioReviews,
  replyMinLength,
  saveReviewReply,
  type StudioReview,
} from '@/lib/studio-insights';
import { colors, radius, space, type } from '@/theme';

/** Отзывы на занятия инструктора с ответом. Показываются только одобренные, как на вебе. */
export default function StudioReviewsScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const r = c.reviews;
  const insets = useSafeAreaInsets();

  const [reviews, setReviews] = useState<StudioReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listStudioReviews();
      setReviews(data.reviews);
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? c.errors.generic.description);
    } finally {
      setLoaded(true);
    }
  }, [c.errors.generic.description]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function save(review: StudioReview) {
    const text = (drafts[review.id] ?? '').trim();
    if (text.length < replyMinLength) return;
    setBusyId(review.id);
    setNotice(null);
    try {
      await saveReviewReply(review.id, text);
      setDrafts((state) => ({ ...state, [review.id]: '' }));
      setNotice({ id: review.id, ok: true, text: r.replySaved });
      await load();
    } catch (error) {
      setNotice({ id: review.id, ok: false, text: serverMessageOf(error) ?? c.errors.generic.description });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(review: StudioReview) {
    setBusyId(review.id);
    setNotice(null);
    try {
      await deleteReviewReply(review.id);
      setNotice({ id: review.id, ok: true, text: r.replyDeleted });
      await load();
    } catch (error) {
      setNotice({ id: review.id, ok: false, text: serverMessageOf(error) ?? c.errors.generic.description });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {r.title}
        </Text>
      </Animated.View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : reviews.length === 0 ? (
        <EmptyState icon="star-outline" title={r.empty} body={r.emptyHint} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        >
          <Text style={type.bodySm}>{r.studioSubtitle}</Text>

          {reviews.map((review, index) => {
            const draft = drafts[review.id] ?? '';
            const busy = busyId === review.id;
            const tooShort = draft.trim().length < replyMinLength;
            return (
              <Animated.View key={review.id} entering={FadeInDown.delay(index * 60).duration(420).easing(EASE_OUT)} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={type.label}>{review.authorName}</Text>
                  <Text style={type.bodySm}>
                    {review.rating}/5 · {dateLabel(review.createdAt, locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Text style={type.bodySm}>{review.body}</Text>

                <View style={styles.replyBox}>
                  <Text style={type.eyebrow}>{r.replyTitle}</Text>
                  {review.reply !== null ? (
                    <>
                      <Text style={type.bodySm}>{review.reply}</Text>
                      <View style={styles.row}>
                        <Button
                          label={r.replyDelete}
                          variant="ghost"
                          onPress={() => void remove(review)}
                          busy={busy}
                          disabled={busy}
                        />
                      </View>
                    </>
                  ) : null}

                  <TextInput
                    value={draft}
                    onChangeText={(text) => setDrafts((state) => ({ ...state, [review.id]: text }))}
                    placeholder={r.replyPlaceholder}
                    multiline
                    maxLength={2000}
                    accessibilityLabel={r.replyLabel}
                    style={styles.input}
                  />
                  <Text style={type.caption}>{r.replyHint.replace('{min}', String(replyMinLength))}</Text>
                  <View style={styles.row}>
                    <Button
                      label={review.reply !== null ? r.replyUpdate : r.replySubmit}
                      onPress={() => void save(review)}
                      busy={busy}
                      disabled={busy || tooShort}
                    />
                  </View>
                  {notice?.id === review.id ? (
                    <Text style={[styles.notice, { color: notice.ok ? colors.success : colors.danger }]}>{notice.text}</Text>
                  ) : null}
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  title: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  replyBox: { gap: space.sm, marginTop: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: { minHeight: 64, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: 'rgba(245,241,234,0.12)', borderRadius: radius.sm, padding: space.md },
  notice: { fontSize: 13 },
});
