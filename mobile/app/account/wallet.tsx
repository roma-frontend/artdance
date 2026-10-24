import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { getMyWallet, type ClientWallet, type WalletEntry } from '@/lib/account-data';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { serverMessageOf } from '@/lib/server-message';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

const KINDS = ['CREDIT_TOPUP', 'CREDIT_REFUND', 'CREDIT_REFERRAL', 'CREDIT_GIFT', 'DEBIT_CHECKOUT', 'DEBIT_MANUAL'] as const;

export default function MyWalletScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [wallet, setWallet] = useState<ClientWallet | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setWallet(await getMyWallet());
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

  if (wallet === null && failed === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  const w = c.account.walletScreen;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{w.title}</Text>
      </Animated.View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={wallet?.entries ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        ListHeaderComponent={
          wallet ? (
            <Animated.View entering={FadeInDown.delay(60).duration(420).easing(EASE_OUT)} style={styles.balance}>
              <Text style={type.eyebrow}>{w.balanceTitle}</Text>
              <Text style={type.h1}>{price(wallet.balance, locale)}</Text>
              <Text style={type.bodySm}>{w.hint}</Text>
            </Animated.View>
          ) : undefined
        }
        ListEmptyComponent={failed !== null ? <EmptyState icon="alert-circle-outline" title={failed} /> : undefined}
        renderItem={({ item, index }) => (
          <Animated.View entering={enterItem(index, 120)} layout={LinearTransition.springify().damping(18)}>
            <EntryRow entry={item} locale={locale} labels={w.kinds} />
          </Animated.View>
        )}
      />
    </View>
  );
}

function EntryRow({ entry, locale, labels }: { entry: WalletEntry; locale: ReturnType<typeof deviceLocale>; labels: Record<string, string> }) {
  const known = (KINDS as readonly string[]).includes(entry.kind);
  const sign = entry.amount > 0 ? '+' : '−';
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={type.label}>{known ? labels[entry.kind] : entry.kind}</Text>
        <Text style={type.bodySm}>{dateLabel(entry.createdAt, locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      <Text style={[styles.amount, entry.amount >= 0 ? styles.plus : styles.minus]}>
        {sign}
        {price(Math.abs(entry.amount), locale)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.sm },
  balance: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 6, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  amount: { fontSize: 15, fontWeight: '700' },
  plus: { color: colors.success },
  minus: { color: colors.danger },
});
