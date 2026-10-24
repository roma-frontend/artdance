import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { GiftCardRedeemError, redeemGiftCard } from '@/lib/gift-cards';
import { price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/** Границы совпадают с веб-формой: код от 4 до 24 символов, латиница, цифры и дефис. */
const MIN_LENGTH = 4;
const MAX_LENGTH = 24;

function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, MAX_LENGTH);
}

type Notice = { tone: 'success' | 'error'; text: string };

export default function GiftCardRedeemScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const canSubmit = code.length >= MIN_LENGTH && !sending;

  function failureText(error: unknown): string {
    if (error instanceof GiftCardRedeemError) {
      if (error.code === 'NOT_FOUND') return c.footer.redeemNotFound;
      if (error.code === 'EXPIRED') return c.footer.redeemExpired;
      if (error.code === 'ALREADY_REDEEMED') return c.footer.redeemAlreadyUsed;
    }
    return t.catalogError;
  }

  async function onSubmit() {
    setSending(true);
    setNotice(null);
    try {
      const card = await redeemGiftCard(code);
      setNotice({ tone: 'success', text: c.footer.redeemSuccess.replace('{balance}', price(card.balance, locale)) });
    } catch (error) {
      setNotice({ tone: 'error', text: failureText(error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.footer.redeemGiftCard}</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={enterItem(0)} style={styles.section}>
          <Text style={type.bodySm}>{c.footer.activateHint}</Text>
          <Text style={type.eyebrow}>{c.footer.giftCardCode}</Text>
          <TextInput
            value={code}
            onChangeText={(next) => setCode(normalizeCode(next))}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor={colors.text3}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={MAX_LENGTH}
            editable={!sending}
            style={styles.input}
          />
        </Animated.View>

        <Button label={c.footer.redeemCta} onPress={onSubmit} busy={sending} disabled={!canSubmit} />

        {notice ? (
          <Animated.View entering={enterItem(1)} style={styles.card}>
            <Text style={[type.bodySm, { color: notice.tone === 'success' ? colors.success : colors.danger }]}>{notice.text}</Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.lg },
  section: { gap: space.sm },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)' },
  input: {
    ...type.body,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    letterSpacing: 1,
  },
});
