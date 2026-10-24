import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { getMySubscription, type ClientSubscription } from '@/lib/account-data';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { serverMessageOf } from '@/lib/server-message';
import { EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

const METRIC_KEYS = ['groupClasses', 'privateSessions'] as const;

export default function MySubscriptionScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [subscription, setSubscription] = useState<ClientSubscription | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSubscription(await getMySubscription());
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const s = c.account.subscription;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{s.title}</Text>
      </Animated.View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : !subscription ? (
        <EmptyState icon="ribbon-outline" title={s.empty} body={s.emptyHint} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        >
          <Animated.View entering={FadeInDown.delay(80).duration(420).easing(EASE_OUT)} style={styles.card}>
            <Text style={type.h3}>{subscription.planId}</Text>
            <Text style={type.bodySm}>{subscription.cancelAtPeriodEnd ? s.cancelAtPeriodEnd : subscription.status}</Text>
            <Text style={type.bodySm}>
              {s.period}:{' '}
              {dateLabel(subscription.currentPeriodStart, locale, { day: '2-digit', month: 'short' })} —{' '}
              {dateLabel(subscription.currentPeriodEnd, locale, { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            <Text style={type.label}>{price(subscription.price, locale)}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(420).easing(EASE_OUT)} style={styles.card}>
            <Text style={type.eyebrow}>{s.usageTitle}</Text>
            {subscription.usage.length === 0 ? (
              <Text style={type.bodySm}>{s.usageEmpty}</Text>
            ) : (
              METRIC_KEYS.map((metric) => (
                <View key={metric} style={styles.metricRow}>
                  <Text style={type.bodySm}>{s.metrics[metric]}</Text>
                  <Text style={type.label}>{subscription.usage.find((u) => u.metric === metric)?.used ?? 0}</Text>
                </View>
              ))
            )}
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  content: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 6 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
