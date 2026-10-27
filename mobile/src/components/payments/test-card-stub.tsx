import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { colors, space } from '@/theme';

export type TestScenario = 'success' | 'declined';

type Resolver = (scenario: TestScenario | null) => void;

let openStub: ((resolve: Resolver) => void) | null = null;

/**
 * Открывает заглушку ввода тестовой карты. Используется только когда нативная форма Stripe недоступна (Expo Go).
 * Возвращает сценарий тестовой карты или null, если пользователь закрыл заглушку.
 */
export function promptTestCard(): Promise<TestScenario | null> {
  return new Promise((resolve) => {
    if (!openStub) {
      resolve(null);
      return;
    }
    openStub(resolve);
  });
}

const SUCCESS_CARD = '4242424242424242';
const DECLINED_CARD = '4000000000000002';

/** Монтируется один раз в корневом layout. */
export function TestCardStubHost() {
  const [resolver, setResolver] = useState<Resolver | null>(null);
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    openStub = (resolve) => {
      setError(null);
      setResolver(() => resolve);
    };
    return () => {
      openStub = null;
    };
  }, []);

  const close = (scenario: TestScenario | null) => {
    resolver?.(scenario);
    setResolver(null);
    setNumber('');
    setExpiry('');
    setCvc('');
    setError(null);
  };

  const submit = () => {
    const digits = number.replace(/\s+/g, '');
    if (!/^\d{2}\/\d{2}$/.test(expiry.trim())) {
      setError('Срок в формате ММ/ГГ');
      return;
    }
    if (!/^\d{3,4}$/.test(cvc.trim())) {
      setError('CVC: 3 или 4 цифры');
      return;
    }
    if (digits === SUCCESS_CARD) {
      close('success');
      return;
    }
    if (digits === DECLINED_CARD) {
      close('declined');
      return;
    }
    setError('Тестовая карта: 4242 4242 4242 4242 (отказ: 4000 0000 0000 0002)');
  };

  return (
    <Modal visible={resolver !== null} transparent animationType="fade" onRequestClose={() => close(null)}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: space.xl }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: space.xl, gap: space.md, borderWidth: 1, borderColor: colors.lineStrong }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>Тестовая оплата</Text>
          <Text style={{ color: colors.text2, fontSize: 13 }}>
            Режим Expo Go: нативная форма Stripe недоступна. Введите тестовую карту 4242 4242 4242 4242.
          </Text>
          <TextInput
            value={number}
            onChangeText={setNumber}
            placeholder="Номер карты"
            placeholderTextColor={colors.text3}
            keyboardType="number-pad"
            maxLength={19}
            style={inputStyle}
          />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <TextInput
              value={expiry}
              onChangeText={setExpiry}
              placeholder="ММ/ГГ"
              placeholderTextColor={colors.text3}
              keyboardType="number-pad"
              maxLength={5}
              style={[inputStyle, { flex: 1 }]}
            />
            <TextInput
              value={cvc}
              onChangeText={setCvc}
              placeholder="CVC"
              placeholderTextColor={colors.text3}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              style={[inputStyle, { flex: 1 }]}
            />
          </View>
          {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
          <Pressable onPress={submit} style={{ backgroundColor: colors.accentBright, borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontWeight: '600' }}>Оплатить</Text>
          </Pressable>
          <Pressable onPress={() => close(null)} style={{ alignItems: 'center', paddingVertical: space.sm }}>
            <Text style={{ color: colors.text2 }}>Отмена</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const inputStyle = {
  color: colors.text,
  backgroundColor: colors.surface2,
  borderRadius: 12,
  paddingHorizontal: space.lg,
  paddingVertical: 12,
  borderWidth: 1,
  borderColor: colors.line,
  fontSize: 16,
} as const;
