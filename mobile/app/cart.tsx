import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FadeImage } from '@/components/ui/fade-image';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SwipeActionRow } from '@/components/ui/swipe-action-row';
import { catalogFor } from '@/i18n/catalog';
import { mediaUri } from '@/lib/catalog';
import {
  applyPromoCode,
  CartError,
  getCart,
  removeCartItem,
  removePromoCode,
  setCartItemQuantity,
  type CartIssue,
  type CartItem,
  type CartSnapshot,
} from '@/lib/cart';
import { plural, price } from '@/lib/format';
import { serverMessageOf } from '@/lib/server-message';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { useAppActive } from '@/lib/use-app-active';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

type Locale = ReturnType<typeof deviceLocale>;
type Catalog = ReturnType<typeof catalogFor>;

/** `itemsCount` — это «Подытог ({count, plural, …})»: скобки снаружи, `plural()` работает с внутренним шаблоном. */
function itemsLabel(template: string, count: number, locale: Locale): string {
  const open = template.indexOf('(');
  const close = template.lastIndexOf(')');
  if (open < 0 || close < open) return template;
  const counted = plural(template.slice(open + 1, close), count, locale);
  return `${template.slice(0, open).trim()} (${counted})`;
}

/** Предупреждения сервера переводятся в строки интерфейса; повторы схлопываются. */
function issueTexts(issues: readonly CartIssue[], c: Catalog): string[] {
  const texts = issues.map((issue) => {
    switch (issue.type) {
      case 'priceChanged':
        return c.cart.pricesChanged;
      case 'outOfStock':
        return c.shop.outOfStock;
      case 'quantityClamped':
        return c.shop.lowStock.replace('{count}', String(issue.allowed));
      case 'promoInvalid':
        return c.cart.promoInvalid;
    }
  });
  return [...new Set(texts)];
}

export default function CartScreen() {
  const locale = deviceLocale(undefined);
  const m = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [promo, setPromo] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  /** Показывается только ответ на последний запрос: старое чтение не перетирает результат изменения. */
  const revision = useRef(0);
  const mutating = useRef(false);

  const load = useCallback(async () => {
    if (mutating.current) return;
    const rev = ++revision.current;
    try {
      const next = await getCart();
      if (rev !== revision.current) return;
      setCart(next);
      setFailed(null);
    } catch (error) {
      if (rev === revision.current) setFailed(serverMessageOf(error) ?? m.catalogError);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAppActive(load);

  /** Каждая операция возвращает свежий снимок корзины: его и показываем. Операции идут по одной. */
  async function run(action: () => Promise<CartSnapshot>): Promise<boolean> {
    if (mutating.current) return false;
    mutating.current = true;
    const rev = ++revision.current;
    setBusy(true);
    try {
      const next = await action();
      if (rev === revision.current) setCart(next);
      return true;
    } catch (e) {
      Alert.alert(serverMessageOf(e) ?? m.genericError);
      return false;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }

  async function applyPromo() {
    const code = promo.trim();
    if (!code || mutating.current) return;
    mutating.current = true;
    const rev = ++revision.current;
    setBusy(true);
    setPromoError(null);
    try {
      const next = await applyPromoCode(code);
      if (rev === revision.current) setCart(next);
      setPromo('');
    } catch (e) {
      // Неверный/истёкший/исчерпанный код сервер отдаёт как 422 (VALIDATION_FAILED).
      if (e instanceof CartError && e.status === 422) setPromoError(c.cart.promoInvalid);
      else Alert.alert(serverMessageOf(e) ?? m.genericError);
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }

  function openCheckout() {
    router.push('/checkout');
  }

  if (cart === null && failed === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  const items = cart?.items ?? [];
  const texts = issueTexts(cart?.issues ?? [], c);
  const totals = cart?.totals;
  const canCheckout = items.some((item) => item.isActive && item.stock > 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={c.common.actions.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.cart.title}</Text>
      </Animated.View>

      {failed !== null && cart === null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : items.length === 0 ? (
        <EmptyState icon="cart-outline" title={c.cart.empty} body={c.cart.emptyHint} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: space.xxxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {items.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={enterItem(index)}
              exiting={FadeOut.duration(180)}
              layout={LinearTransition.springify().damping(18)}
            >
              <SwipeActionRow actionLabel={c.common.actions.remove} disabled={busy} onAction={() => run(() => removeCartItem(item.id))}>
                <CartRow
                  item={item}
                  locale={locale}
                  disabled={busy}
                  onQuantity={(quantity) => run(() => setCartItemQuantity(item.id, quantity))}
                  onRemove={() => run(() => removeCartItem(item.id))}
                />
              </SwipeActionRow>
            </Animated.View>
          ))}

          {texts.length > 0 ? (
            <View style={styles.notice}>
              {texts.map((text) => (
                <Text key={text} style={styles.noticeText}>
                  {text}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.promoRow}>
              <TextInput
                value={promo}
                onChangeText={setPromo}
                placeholder={c.cart.promoPlaceholder}
                placeholderTextColor={colors.text3}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!busy}
                returnKeyType="done"
                onSubmitEditing={applyPromo}
                style={styles.promoInput}
              />
              <Button label={c.cart.promoApply} variant="ghost" onPress={applyPromo} disabled={busy || promo.trim() === ''} style={styles.promoButton} />
            </View>
            {promoError ? <Text style={styles.promoError}>{promoError}</Text> : null}
            {cart?.promoCode ? (
              <View style={styles.promoApplied}>
                <Text style={type.label}>{cart.promoCode}</Text>
                <Pressable onPress={() => run(() => removePromoCode())} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel={c.common.actions.remove}>
                  <Ionicons name="close-circle" size={20} color={colors.text3} />
                </Pressable>
              </View>
            ) : null}
          </View>

          {totals ? (
            <View style={styles.card}>
              <SummaryRow label={itemsLabel(c.cart.itemsCount, totals.itemCount, locale)} value={price(totals.subtotal, locale)} />
              {totals.discount > 0 ? <SummaryRow label={c.common.labels.discount} value={`−${price(totals.discount, locale)}`} /> : null}
              {totals.deliveryFee > 0 ? <SummaryRow label={c.common.labels.delivery} value={price(totals.deliveryFee, locale)} /> : null}
              <View style={styles.divider} />
              <SummaryRow label={c.common.labels.total} value={price(totals.total, locale)} strong />
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Кнопка оформления всегда под рукой, как нижняя панель экрана брони. */}
      {items.length > 0 ? (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.barTotal}>
            <Text style={type.caption}>{c.common.labels.total}</Text>
            <Text style={styles.totalValue} numberOfLines={1}>
              {totals ? price(totals.total, locale) : '—'}
            </Text>
          </View>
          <Button
            label={c.common.actions.checkout}
            icon="arrow-forward"
            onPress={openCheckout}
            disabled={busy || !canCheckout}
            style={styles.checkout}
          />
        </View>
      ) : null}
    </View>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={strong ? type.title : styles.summaryLabel}>{label}</Text>
      <Text style={strong ? styles.totalValue : styles.summaryValue}>{value}</Text>
    </View>
  );
}

function CartRow({
  item,
  locale,
  disabled,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  locale: Locale;
  disabled: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const c = catalogFor(locale);
  const available = item.isActive && item.stock > 0;

  return (
    <View style={styles.itemCard}>
      <View style={styles.thumb}>
        {item.image ? <FadeImage uri={mediaUri(item.image.key)} /> : <Ionicons name="bag-outline" size={22} color={colors.text3} />}
      </View>
      <View style={styles.itemBody}>
        {item.brand ? <Text style={type.caption}>{item.brand}</Text> : null}
        <Text style={type.label} numberOfLines={2}>
          {item.title}
        </Text>
        {available ? null : <Text style={styles.unavailable}>{c.shop.outOfStock}</Text>}
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => onQuantity(item.quantity - 1)}
            disabled={disabled || item.quantity <= 1}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={c.common.labels.quantity}
            style={[styles.stepBtn, (disabled || item.quantity <= 1) && styles.stepBtnOff]}
          >
            <Ionicons name="remove" size={16} color={colors.text} />
          </Pressable>
          <Text style={styles.qty}>{item.quantity}</Text>
          <Pressable
            onPress={() => onQuantity(item.quantity + 1)}
            disabled={disabled || !available || item.quantity >= item.stock}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={c.common.labels.quantity}
            style={[styles.stepBtn, (disabled || !available || item.quantity >= item.stock) && styles.stepBtnOff]}
          >
            <Ionicons name="add" size={16} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <View style={styles.itemEnd}>
        <Text style={styles.lineTotal}>{price(item.unitPrice * item.quantity, locale)}</Text>
        <Pressable onPress={onRemove} disabled={disabled} hitSlop={10} accessibilityRole="button" accessibilityLabel={c.common.actions.remove}>
          <Ionicons name="trash-outline" size={18} color={colors.text3} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  scroll: { paddingHorizontal: space.lg, gap: space.md },
  itemCard: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, gap: 4 },
  unavailable: { ...type.caption, color: colors.danger },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: { opacity: 0.35 },
  qty: { minWidth: 24, textAlign: 'center', ...type.label },
  itemEnd: { alignItems: 'flex-end', justifyContent: 'space-between' },
  lineTotal: { ...type.label, color: colors.metal },
  notice: { gap: 4, padding: space.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  noticeText: { ...type.bodySm, color: colors.text },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: space.md },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  promoInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    color: colors.text,
    fontSize: 15,
  },
  promoButton: { minWidth: 96 },
  promoError: { ...type.bodySm, color: colors.danger, marginTop: space.sm },
  promoApplied: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { ...type.bodySm },
  summaryValue: { ...type.label },
  totalValue: { ...type.h3, color: colors.metal },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
  checkout: { flexShrink: 0 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingTop: 14,
    paddingHorizontal: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  barTotal: { flex: 1, gap: 2 },
});
