import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { getCompanyAccount, type CompanyAccount } from '@/lib/corporate';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };

/** Кабинет компании: баланс и счета. Только чтение; оплата и списание делает администратор. */
export default function CompanyAccountScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const cab = c.corporate.cabinet;
  const insets = useSafeAreaInsets();

  const [account, setAccount] = useState<CompanyAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getCompanyAccount();
      setAccount(data.account);
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {cab.title}
        </Text>
      </Animated.View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : account === null ? (
        <EmptyState icon="business-outline" title={cab.notLinked} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        >
          <Text style={type.bodySm}>{cab.intro}</Text>

          <View style={styles.card}>
            <Text style={type.h3}>{account.name}</Text>
            <Text style={type.caption}>{cab.balance}</Text>
            <Text style={type.h2}>{price(account.balance, locale)}</Text>
          </View>

          <Text style={type.eyebrow}>{cab.invoicesTitle}</Text>
          {account.invoices.length === 0 ? (
            <Text style={type.bodySm}>{cab.none}</Text>
          ) : (
            account.invoices.map((invoice, index) => (
              <Animated.View key={invoice.number} entering={FadeInDown.delay(index * 50).duration(420).easing(EASE_OUT)} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={type.label}>{invoice.number}</Text>
                  <Text style={type.label}>{cab.statuses[invoice.status]}</Text>
                </View>
                <Text style={type.bodySm}>
                  {cab.amount}: {price(invoice.amount, locale)}
                </Text>
                <Text style={type.bodySm}>
                  {cab.issued}: {dateLabel(invoice.issuedAt, locale, DATE_OPTIONS)}
                </Text>
                {invoice.order ? (
                  <Text style={type.bodySm}>
                    {cab.orderHeader}: {invoice.order.orderNumber}
                  </Text>
                ) : null}
              </Animated.View>
            ))
          )}
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
});
