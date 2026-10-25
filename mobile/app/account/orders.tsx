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
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { listMyOrders, orderStatusLabel, type ClientOrder } from '@/lib/orders';
import { serverMessageOf } from '@/lib/server-message';
import { useAppActive } from '@/lib/use-app-active';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

export default function MyOrdersScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<ClientOrder[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrders(await listMyOrders());
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAppActive(load);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (orders === null && failed === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.account.orders.title}</Text>
      </Animated.View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={orders ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        ListEmptyComponent={
          failed !== null ? (
            <EmptyState icon="alert-circle-outline" title={failed} />
          ) : (
            <EmptyState icon="receipt-outline" title={c.account.orders.empty} />
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={enterItem(index)} layout={LinearTransition.springify().damping(18)}>
            <PressableScale
              onPress={() => router.push({ pathname: '/account/orders/[orderNumber]', params: { orderNumber: item.orderNumber } })}
              accessibilityRole="button"
              style={styles.card}
            >
              <Text style={type.h3} numberOfLines={1}>
                {c.account.orders.orderNumber.replace('{number}', item.orderNumber)}
              </Text>
              <Text style={type.bodySm} numberOfLines={2}>
                {item.items.map((i) => (i.quantity > 1 ? `${i.title} × ${i.quantity}` : i.title)).join(', ')}
              </Text>
              <Text style={type.bodySm}>{dateLabel(item.placedAt, locale, { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
              <View style={styles.footer}>
                <Text style={styles.status}>{orderStatusLabel(item.status, c)}</Text>
                <Text style={type.label}>{price(item.total, locale)}</Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  status: { fontSize: 12, fontWeight: '700', color: colors.metal },
});
