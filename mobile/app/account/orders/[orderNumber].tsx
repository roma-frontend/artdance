import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { getMyOrder, orderStatusLabel, paymentStatusLabel, type ClientOrderDetail } from '@/lib/orders';
import { serverMessageOf } from '@/lib/server-message';
import { EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

export default function OrderDetailScreen() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<ClientOrderDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await getMyOrder(orderNumber));
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, [orderNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={[type.h2, styles.headerTitle]} numberOfLines={1}>
        {c.account.orders.orderNumber.replace('{number}', orderNumber)}
      </Text>
    </Animated.View>
  );

  if (order === null) {
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
          <View style={styles.row}>
            <Text style={styles.status}>{orderStatusLabel(order.status, c)}</Text>
            <Text style={type.bodySm}>
              {dateLabel(order.placedAt, locale, { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={type.h3}>{c.account.orders.itemsTitle}</Text>
          {order.items.map((item, index) => (
            <View key={`${item.title}-${index}`} style={styles.row}>
              <Text style={[type.bodySm, styles.grow]} numberOfLines={2}>
                {item.quantity > 1 ? `${item.title} × ${item.quantity}` : item.title}
              </Text>
              <Text style={type.label}>{price(item.lineTotal, locale)}</Text>
            </View>
          ))}
          <View style={styles.totals}>
            <TotalRow label={c.common.labels.subtotal} value={price(order.subtotal, locale)} />
            {order.discountTotal > 0 ? (
              <TotalRow label={c.common.labels.discount} value={`−${price(order.discountTotal, locale)}`} />
            ) : null}
            {order.deliveryFee > 0 ? (
              <TotalRow label={c.common.labels.delivery} value={price(order.deliveryFee, locale)} />
            ) : null}
            <TotalRow label={c.common.labels.total} value={price(order.total, locale)} strong />
          </View>
        </View>

        {order.payments.length > 0 ? (
          <View style={styles.card}>
            <Text style={type.h3}>{c.account.orders.paymentTitle}</Text>
            {order.payments.map((payment, index) => (
              <View key={index} style={styles.row}>
                <Text style={[type.bodySm, styles.grow]}>{paymentStatusLabel(payment.status, c)}</Text>
                <Text style={type.label}>{price(payment.amount, locale)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[type.bodySm, styles.grow]}>{label}</Text>
      <Text style={strong ? type.label : type.bodySm}>{value}</Text>
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
  status: { fontSize: 12, fontWeight: '700', color: colors.metal },
  totals: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space.sm, gap: space.sm },
});
