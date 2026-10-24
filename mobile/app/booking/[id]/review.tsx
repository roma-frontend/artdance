import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { canReviewBooking, getMyBooking, submitBookingReview, type ClientBookingDetail } from '@/lib/bookings';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

/** Границы текста совпадают с `reviews.minLength` и `reviews.maxLength` на сервере. */
const MIN_LENGTH = 20;
const MAX_LENGTH = 2000;
const STARS = [1, 2, 3, 4, 5];

export default function BookingReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const r = c.reviews;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<ClientBookingDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;
    getMyBooking(id)
      .then((next) => {
        if (active) setBooking(next);
      })
      .catch((error: unknown) => {
        if (active) setFailed(serverMessageOf(error) ?? t.catalogError);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const trimmed = text.trim();
  const canSubmit = trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH && !sending;

  async function onSubmit() {
    setSending(true);
    try {
      await submitBookingReview({ bookingId: id, rating, body: trimmed });
      setSent(true);
    } catch (error) {
      Alert.alert(serverMessageOf(error) ?? t.catalogError);
    } finally {
      setSending(false);
    }
  }

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={type.h2}>{r.writeTitle}</Text>
    </Animated.View>
  );

  function shell(children: ReactNode) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        {children}
      </View>
    );
  }

  if (failed !== null) {
    return shell(<EmptyState icon="alert-circle-outline" title={failed} />);
  }

  if (!booking) {
    return shell(
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentBright} />
      </View>,
    );
  }

  if (sent) {
    return shell(<EmptyState icon="checkmark-circle-outline" title={r.pendingNotice} />);
  }

  if (booking.reviewModeration !== null) {
    return shell(<EmptyState icon="checkmark-circle-outline" title={r.alreadyReviewed} />);
  }

  if (!canReviewBooking(booking)) {
    return shell(<EmptyState icon="alert-circle-outline" title={r.onlyAfterBooking} />);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Animated.View entering={enterItem(0)} style={styles.card}>
          <Text style={type.h3}>{booking.classTitle ?? booking.reference}</Text>
          {booking.instructorName ? <Text style={type.bodySm}>{booking.instructorName}</Text> : null}
        </Animated.View>

        <Animated.View entering={enterItem(1)} style={styles.section}>
          <Text style={type.eyebrow}>{r.ratingLabel}</Text>
          <View style={styles.stars}>
            {STARS.map((value) => (
              <PressableScale key={value} onPress={() => setRating(value)} accessibilityRole="button" accessibilityLabel={`${value}`}>
                <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={36} color={colors.accentBright} />
              </PressableScale>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={enterItem(2)} style={styles.section}>
          <Text style={type.eyebrow}>{r.textLabel}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={r.textPlaceholder}
            placeholderTextColor={colors.text3}
            multiline
            maxLength={MAX_LENGTH}
            textAlignVertical="top"
            style={styles.input}
          />
        </Animated.View>

        <Button label={r.submit} onPress={onSubmit} busy={sending} disabled={!canSubmit} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.lg },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  section: { gap: space.sm },
  stars: { flexDirection: 'row', gap: space.sm },
  input: {
    ...type.body,
    minHeight: 140,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
  },
});
