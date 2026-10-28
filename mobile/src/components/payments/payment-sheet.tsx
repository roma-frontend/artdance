import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  formatCardNumber,
  formatExpiry,
  isCardDetailsComplete,
  testCardScenario,
  type TestScenario,
} from '@/components/payments/test-card-stub';
import { Button } from '@/components/ui/button';
import { catalogFor } from '@/i18n/catalog';
import { useLocale } from '@/lib/app-locale';
import { price } from '@/lib/format';
import { NativeCardField } from '@/lib/stripe-sheet';
import { colors, radius, space, type } from '@/theme';

/** Итог формы. PAID означает, что провайдер принял платёж; окончательно его подтверждает сверка на сервере. */
export type SheetOutcome = 'PAID' | 'DECLINED' | 'FAILED' | 'CANCELED';

export type SheetRequest = {
  amount: number;
  /** native — поле карты Stripe; stub — тестовая карта (Expo Go и mock-провайдер). */
  mode: 'native' | 'stub';
  /** Отправляет оплату. В stub получает сценарий тестовой карты, в native — null. */
  submit: (scenario: TestScenario | null) => Promise<SheetOutcome>;
};

type Pending = SheetRequest & { resolve: (outcome: SheetOutcome) => void };

let opener: ((request: Pending) => void) | null = null;

/**
 * Открывает встроенную форму оплаты и ждёт итог. Если хост не смонтирован, сразу возвращает FAILED,
 * чтобы экран не завис.
 */
export function presentPaymentSheet(request: SheetRequest): Promise<SheetOutcome> {
  return new Promise((resolve) => {
    if (!opener) {
      resolve('FAILED');
      return;
    }
    opener({ ...request, resolve });
  });
}

/** Монтируется один раз в корневом layout. Показывает форму оплаты в фирменном оформлении приложения. */
export function PaymentSheetHost() {
  const locale = useLocale();
  const c = catalogFor(locale);
  const pendingRef = useRef<Pending | null>(null);
  const [active, setActive] = useState<Pending | null>(null);
  const [visible, setVisible] = useState(false);
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [nativeComplete, setNativeComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    opener = (request) => {
      pendingRef.current?.resolve('CANCELED');
      pendingRef.current = request;
      setActive(request);
      setVisible(true);
      setNumber('');
      setExpiry('');
      setCvc('');
      setNativeComplete(false);
      setBusy(false);
      setNotice(null);
    };
    return () => {
      opener = null;
      pendingRef.current?.resolve('CANCELED');
      pendingRef.current = null;
    };
  }, []);

  const finish = (request: Pending, outcome: SheetOutcome) => {
    request.resolve(outcome);
    if (pendingRef.current === request) {
      pendingRef.current = null;
      setVisible(false);
    }
  };

  const cancel = () => {
    const current = pendingRef.current;
    if (!current || busy) return;
    finish(current, 'CANCELED');
  };

  const pay = async () => {
    const current = pendingRef.current;
    if (!current || busy) return;

    let scenario: TestScenario | null = null;
    if (current.mode === 'stub') {
      if (!isCardDetailsComplete({ number, expiry, cvc })) {
        setNotice(c.checkout.sheet.cardIncomplete);
        return;
      }
      scenario = testCardScenario(number);
      if (!scenario) {
        setNotice(c.checkout.sheet.useTestCard);
        return;
      }
    }

    setNotice(null);
    setBusy(true);
    let outcome: SheetOutcome;
    try {
      outcome = await current.submit(scenario);
    } catch {
      outcome = 'FAILED';
    }
    setBusy(false);
    finish(current, outcome);
  };

  const mode = active?.mode ?? 'stub';
  const amount = active?.amount ?? 0;
  const payDisabled = busy || (mode === 'native' && !nativeComplete);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={cancel}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityRole="button" accessibilityLabel={c.common.actions.cancel} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={type.eyebrow}>{c.checkout.sheet.title}</Text>
            <View>
              <Text style={type.h2}>{price(amount, locale)}</Text>
              <Text style={[type.caption, styles.muted]}>{c.checkout.sheet.amountLabel}</Text>
            </View>

            {mode === 'native' ? (
              <NativeCardField onComplete={setNativeComplete} />
            ) : (
              <View style={styles.stub}>
                <Text style={[type.caption, styles.muted]}>{c.checkout.sheet.testMode}</Text>
                <Text style={[type.caption, styles.muted]}>{c.checkout.sheet.testCards}</Text>
                <TextInput
                  accessibilityLabel={c.checkout.payment.cardNumber}
                  value={number}
                  onChangeText={(next) => setNumber(formatCardNumber(next))}
                  placeholder={c.checkout.payment.cardNumber}
                  placeholderTextColor={colors.text3}
                  keyboardType="number-pad"
                  maxLength={19}
                  style={styles.input}
                />
                <View style={styles.row}>
                  <TextInput
                    accessibilityLabel={c.checkout.payment.expiry}
                    value={expiry}
                    onChangeText={(next) => setExpiry(formatExpiry(next))}
                    placeholder={c.checkout.payment.expiry}
                    placeholderTextColor={colors.text3}
                    keyboardType="number-pad"
                    maxLength={5}
                    style={[styles.input, styles.flex]}
                  />
                  <TextInput
                    accessibilityLabel={c.checkout.payment.cvv}
                    value={cvc}
                    onChangeText={(next) => setCvc(next.replace(/\D/g, '').slice(0, 4))}
                    placeholder={c.checkout.payment.cvv}
                    placeholderTextColor={colors.text3}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    style={[styles.input, styles.flex]}
                  />
                </View>
              </View>
            )}

            {notice ? <Text style={[type.caption, styles.danger]}>{notice}</Text> : null}

            <View style={styles.secure}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.text3} />
              <Text style={[type.caption, styles.muted]}>{c.checkout.sheet.secure}</Text>
            </View>

            <Button
              label={c.checkout.payment.submitCta.replace('{total}', price(amount, locale))}
              onPress={pay}
              busy={busy}
              disabled={payDisabled}
            />
            <Button label={c.common.actions.cancel} onPress={cancel} variant="ghost" disabled={busy} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xxxl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill, backgroundColor: colors.lineStrong },
  stub: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  input: {
    color: colors.text,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 16,
  },
  secure: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  muted: { color: colors.text2 },
  danger: { color: colors.danger },
});
