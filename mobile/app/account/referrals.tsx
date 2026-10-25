import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getMyReferrals, type ClientReferrals, type InvitedReferral } from '@/lib/account-data';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { serverMessageOf } from '@/lib/server-message';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

export default function MyReferralsScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ClientReferrals | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getMyReferrals());
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
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

  if (data === null && failed === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  const r = c.account.referrals;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{r.title}</Text>
      </Animated.View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={data?.invited ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        ListHeaderComponent={
          data ? (
            <Animated.View entering={FadeInDown.delay(60).duration(420).easing(EASE_OUT)} style={styles.card}>
              <Text style={type.eyebrow}>{r.codeLabel}</Text>
              <Text style={styles.code} selectable>
                {data.code}
              </Text>
              <Text style={type.bodySm}>{r.hint.replace('{bonus}', price(data.bonusAmount, locale))}</Text>
            </Animated.View>
          ) : undefined
        }
        ListEmptyComponent={
          failed !== null ? <EmptyState icon="alert-circle-outline" title={failed} /> : <EmptyState icon="people-outline" title={r.empty} />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={enterItem(index, 120)} layout={LinearTransition.springify().damping(18)}>
            <InvitedRow item={item} locale={locale} paidLabel={r.paid} pendingLabel={r.pending} />
          </Animated.View>
        )}
      />
    </View>
  );
}

function InvitedRow({
  item,
  locale,
  paidLabel,
  pendingLabel,
}: {
  item: InvitedReferral;
  locale: ReturnType<typeof deviceLocale>;
  paidLabel: string;
  pendingLabel: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={type.bodySm}>{dateLabel(item.createdAt, locale, { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
      <Text style={[styles.status, item.bonusPaid ? styles.paid : styles.pending]}>{item.bonusPaid ? paidLabel : pendingLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.sm },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 8, marginBottom: space.md },
  code: { fontSize: 22, fontWeight: '700', letterSpacing: 2, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  status: { fontSize: 13, fontWeight: '700' },
  paid: { color: colors.success },
  pending: { color: colors.metal },
});
