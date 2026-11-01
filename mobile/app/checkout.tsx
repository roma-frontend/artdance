import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingInput } from '@/components/auth/floating-input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { getCurrentUser } from '@/lib/auth';
import { getCart, type CartSnapshot } from '@/lib/cart';
import {
  mobilePaymentMethods,
  payMyOrder,
  placeMyOrder,
  type DeliveryMethod,
  type MobilePaymentMethod,
  type PlacedOrder,
} from '@/lib/checkout';
import { catalogFor } from '@/i18n/catalog';
import { plural, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { orderPaymentError, startPayment } from '@/lib/payment-url';
import { serverMessageOf } from '@/lib/server-message';
import { EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

type Locale = ReturnType<typeof deviceLocale>;
type Catalog = ReturnType<typeof catalogFor>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Иконка и подпись способа оплаты. Подписи берутся из общего словаря оформления. */
const PAYMENT_ICONS: Record<MobilePaymentMethod, ComponentProps<typeof Ionicons>['name']> = {
  CARD: 'card-outline',
  ARCA: 'swap-horizontal-outline',
  IDRAM: 'wallet-outline',
  TELCELL: 'phone-portrait-outline',
  CASH_ON_DELIVERY: 'cash-outline',
};

function paymentLabel(method: MobilePaymentMethod, c: Catalog): string {
  switch (method) {
    case 'CARD':
      return c.checkout.payment.methodCard;
    case 'CASH_ON_DELIVERY':
      return c.checkout.payment.methodCash;
    case 'ARCA':
      return c.checkout.payment.methodArca;
    case 'IDRAM':
      return c.checkout.payment.methodIdram;
    case 'TELCELL':
      return c.checkout.payment.methodTelcell;
  }
}

/** `itemsCount` — это «Подытог ({count, plural, …})»: скобки снаружи, `plural()` работает с внутренним шаблоном. */
function itemsLabel(template: string, count: number, locale: Locale): string {
  const open = template.indexOf('(');
  const close = template.lastIndexOf(')');
  if (open < 0 || close < open) return template;
  const counted = plural(template.slice(open + 1, close), count, locale);
  return `${template.slice(0, open).trim()} (${counted})`;
}

/** Ссылки в `termsConsent` записаны тегами; здесь выводим текст, а ссылки — отдельными кнопками. */
function plainTerms(text: string): string {
  return text.replace(/<\/?(terms|refund)>/g, '');
}

/**
 * Оформление заказа: контакт, доставка, оплата и итог в одной форме.
 * Заказ создаётся на сервере из корзины клиента, оплата — через тот же `/api/payments/intent`, что и на сайте.
 */
export default function CheckoutScreen() {
  const locale = deviceLocale(undefined);
  const m = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [delivery, setDelivery] = useState<DeliveryMethod>('COURIER');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<MobilePaymentMethod>('CARD');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [cart, setCart] = useCachedState<CartSnapshot>('account.cart', 'user');
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Заказ, уже созданный в этом сеансе. Повтор после ошибки оплаты платит именно его, а не создаёт второй. */
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [busy, setBusy] = useState(false);
  /** Итог пересчитывается под доставку: пока ответа нет, платить по старой сумме нельзя. */
  const [quoting, setQuoting] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const locked = placed !== null;

  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .catch(() => null)
      .then((user) => {
        if (!alive || !user) return;
        const [first = '', ...rest] = user.name.trim().split(/\s+/);
        setFirstName(first);
        setLastName(rest.join(' '));
        setEmail(user.email);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Итог пересчитывается сервером под выбранную доставку. */
  useEffect(() => {
    let alive = true;
    setQuoting(true);
    getCart(delivery)
      .then((snapshot) => {
        if (!alive) return;
        setCart(snapshot);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (alive) setLoadError(serverMessageOf(error) ?? m.catalogError);
      })
      .finally(() => {
        if (alive) setQuoting(false);
      });
    return () => {
      alive = false;
    };
  }, [delivery]);

  function chooseDelivery(next: DeliveryMethod) {
    if (!locked) setDelivery(next);
  }

  /** Первая ошибка формы, уже переведённая. Сервер повторно проверит всё, что здесь пропущено. */
  function validate(): string | null {
    const v = c.validation;
    if (!firstName.trim() || !lastName.trim()) return v.required;
    if (!EMAIL.test(email.trim())) return v.email;
    if (phone.replace(/\D/g, '').length < 6) return v.phone;
    if (delivery === 'COURIER' && (!street.trim() || !city.trim())) return v.required;
    if (!termsAccepted) return v.termsRequired;
    return null;
  }

  async function submit() {
    if (busy || (quoting && !placed)) return;
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      let order = placed;
      if (!order) {
        const courier = delivery === 'COURIER';
        order = await placeMyOrder({
          contactName: `${firstName.trim()} ${lastName.trim()}`,
          contactEmail: email.trim(),
          contactPhone: phone.trim(),
          deliveryMethod: delivery,
          deliveryAddress: courier
            ? { street: street.trim(), city: city.trim(), postalCode: postalCode.trim() || null }
            : null,
          deliveryNotes: courier && notes.trim() ? notes.trim() : null,
        });
        setPlaced(order);
      }
      const intent = await payMyOrder(order.id, method, locale);
      if (method === 'CASH_ON_DELIVERY') {
        // Наличные при получении: денег сейчас нет, оплата не открывается.
        router.replace({ pathname: '/account/orders/[orderNumber]', params: { orderNumber: intent.orderNumber || order.orderNumber } });
        return;
      }
      const outcome = await startPayment(intent);
      if (outcome !== 'PAID' && outcome !== 'PENDING') {
        // Заказ уже создан: остаёмся на экране, повтор оплатит его же.
        setFormError(orderPaymentError(outcome, c.checkout.payment));
        return;
      }
      router.replace({ pathname: '/account/orders/[orderNumber]', params: { orderNumber: intent.orderNumber || order.orderNumber } });
    } catch (error) {
      setFormError(serverMessageOf(error) ?? m.genericError);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={c.common.actions.back}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={type.h2}>{c.checkout.title}</Text>
    </Animated.View>
  );

  if (cart === null && loadError === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        {header}
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  if (!placed && (loadError !== null || (cart !== null && cart.items.length === 0))) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <EmptyState
          icon="cart-outline"
          title={loadError ?? c.cart.empty}
          body={loadError === null ? c.cart.emptyHint : undefined}
        />
      </View>
    );
  }

  const totals = cart?.totals;
  const canSubmit = !busy && (placed !== null || !quoting) && cart !== null && cart.items.some((item) => item.isActive && item.stock > 0);
  const total = placed?.total ?? totals?.total ?? 0;
  const termsLinks = [
    { label: c.footer.terms, path: '/legal/terms' },
    { label: c.footer.refundPolicy, path: '/legal/refund-policy' },
  ];

  function openLegal(path: string) {
    router.push({ pathname: '/legal', params: { slug: path.replace('/legal/', '') } });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}
      >
        <View style={styles.card}>
          <Text style={type.h3}>{c.checkout.contact.title}</Text>
          <FloatingInput
            label={c.checkout.contact.firstName}
            icon="person-outline"
            value={firstName}
            onChangeText={setFirstName}
            editable={!locked}
            autoComplete="given-name"
            textContentType="givenName"
          />
          <FloatingInput
            label={c.checkout.contact.lastName}
            icon="person-outline"
            value={lastName}
            onChangeText={setLastName}
            editable={!locked}
            autoComplete="family-name"
            textContentType="familyName"
          />
          <FloatingInput
            label={c.checkout.contact.email}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            editable={!locked}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />
          <FloatingInput
            label={c.checkout.contact.phone}
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            editable={!locked}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
        </View>

        <View style={styles.card}>
          <Text style={type.h3}>{c.checkout.delivery.title}</Text>
          <Choice
            label={c.checkout.delivery.methodCourier}
            icon="bicycle-outline"
            selected={delivery === 'COURIER'}
            disabled={locked}
            onPress={() => chooseDelivery('COURIER')}
          />
          <Choice
            label={c.checkout.delivery.methodPickup}
            icon="storefront-outline"
            selected={delivery === 'PICKUP_POINT'}
            disabled={locked}
            onPress={() => chooseDelivery('PICKUP_POINT')}
          />
          {delivery === 'COURIER' ? (
            <View style={styles.stack}>
              <FloatingInput
                label={c.checkout.delivery.address}
                icon="location-outline"
                value={street}
                onChangeText={setStreet}
                editable={!locked}
                autoComplete="street-address"
              />
              <FloatingInput
                label={c.checkout.delivery.city}
                icon="business-outline"
                value={city}
                onChangeText={setCity}
                editable={!locked}
                autoComplete="postal-address-locality"
              />
              <FloatingInput
                label={c.checkout.delivery.postalCode}
                icon="mail-open-outline"
                value={postalCode}
                onChangeText={setPostalCode}
                editable={!locked}
                keyboardType="numeric"
                autoComplete="postal-code"
              />
              <FloatingInput
                label={c.checkout.delivery.notes}
                icon="chatbubble-outline"
                value={notes}
                onChangeText={setNotes}
                editable={!locked}
                maxLength={500}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={type.h3}>{c.checkout.payment.title}</Text>
          {mobilePaymentMethods.map((value) => (
            <Choice
              key={value}
              label={paymentLabel(value, c)}
              icon={PAYMENT_ICONS[value]}
              selected={method === value}
              disabled={busy}
              onPress={() => setMethod(value)}
            />
          ))}
          <Text style={type.caption}>{c.checkout.payment.inAppNote}</Text>
        </View>

        {cart && totals ? (
          <View style={styles.card}>
            <Text style={type.h3}>{c.cart.summaryTitle}</Text>
            <SummaryRow label={itemsLabel(c.cart.itemsCount, totals.itemCount, locale)} value={price(totals.subtotal, locale)} />
            {totals.discount > 0 ? <SummaryRow label={c.common.labels.discount} value={`−${price(totals.discount, locale)}`} /> : null}
            {totals.deliveryFee > 0 ? <SummaryRow label={c.common.labels.delivery} value={price(totals.deliveryFee, locale)} /> : null}
            <View style={styles.divider} />
            <SummaryRow label={c.common.labels.total} value={price(total, locale)} strong />
          </View>
        ) : null}

        <Pressable
          onPress={() => setTermsAccepted((v) => !v)}
          disabled={busy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted, disabled: busy }}
          style={styles.terms}
        >
          <Ionicons name={termsAccepted ? 'checkbox-outline' : 'square-outline'} size={22} color={termsAccepted ? colors.accentBright : colors.text3} />
          <View style={styles.termsText}>
            <Text style={type.bodySm}>{plainTerms(c.checkout.termsConsent)}</Text>
            <View style={styles.termsLinks}>
              {termsLinks.map((link) => (
                <Pressable
                  key={link.path}
                   onPress={() => openLegal(link.path)}
                  hitSlop={8}
                  accessibilityRole="link"
                >
                  <Text style={styles.termsLink}>{link.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>

        {formError ? (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.errorBlock}>
            <Text style={styles.error}>{formError}</Text>
            {placed ? <Text style={type.caption}>{c.checkout.result.failedSubtitle}</Text> : null}
          </Animated.View>
        ) : null}

        <Button
          label={c.checkout.payment.submitCta.replace('{total}', price(total, locale))}
          icon="lock-closed-outline"
          onPress={submit}
          busy={busy}
          disabled={!canSubmit}
        />
      </ScrollView>
    </View>
  );
}

function Choice({
  label,
  icon,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const tint = selected ? colors.accentBright : colors.text3;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[type.label, styles.choiceLabel]}>{label}</Text>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={tint} />
    </Pressable>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.md },
  body: { paddingHorizontal: space.xl, gap: space.lg },
  stack: { gap: space.md },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  choiceOn: { borderColor: colors.accentBright },
  choiceLabel: { flex: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: colors.text2 },
  summaryValue: { fontSize: 14, color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  termsText: { flex: 1, gap: space.sm },
  termsLinks: { flexDirection: 'row', gap: space.lg },
  termsLink: { fontSize: 13, fontWeight: '600', color: colors.accentText, textDecorationLine: 'underline' },
  errorBlock: { gap: space.xs },
  error: { fontSize: 13, color: colors.accentBright },
});
