import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { getCatalogDetail } from '@/lib/catalog';
import {
  isRegistrationOpen,
  isValidBirthDate,
  registerForCompetition,
  type CompetitionCategory,
  type CompetitionEventDetail,
} from '@/lib/events';
import { plural, price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

/** Категория без лимита мест (`spotsLeft` не пришёл) или с местами открыта для выбора. */
const isSelectable = (category: CompetitionCategory) => category.spotsLeft !== 0;

export default function EventRegisterScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<CompetitionEventDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;
    getCatalogDetail<CompetitionEventDetail>('events', slug)
      .then((next) => {
        if (!active) return;
        setDetail(next);
        setCategoryId(next.competitionCategories?.find(isSelectable)?.id ?? null);
      })
      .catch((error: unknown) => {
        if (active) setFailed(serverMessageOf(error) ?? t.catalogError);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={type.h2}>{c.events.registerCta}</Text>
    </Animated.View>
  );

  function shell(children: ReactNode) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        {children}
      </View>
    );
  }

  if (failed !== null) {
    return shell(<EmptyState icon="alert-circle-outline" title={failed} />);
  }

  if (!detail) {
    return shell(
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentBright} />
      </View>,
    );
  }

  if (sent) {
    return shell(<EmptyState icon="checkmark-circle-outline" title={c.events.registrationSuccess} />);
  }

  const categories = detail.competitionCategories ?? [];
  if (detail.type !== 'COMPETITION' || categories.length === 0) {
    return shell(<EmptyState icon="time-outline" title={c.common.states.comingSoon} />);
  }

  if (!isRegistrationOpen(detail)) {
    return shell(<EmptyState icon="lock-closed-outline" title={c.events.registrationClosed} />);
  }

  const birthDateComplete = birthDate.length === 10;
  const birthDateValid = isValidBirthDate(birthDate);
  const canSubmit = categoryId !== null && birthDateValid && !sending;

  async function onSubmit() {
    if (!detail || !categoryId || !canSubmit) return;
    setSending(true);
    setNotice(null);
    try {
      await registerForCompetition(detail.slug, {
        categoryId,
        birthDate,
        partnerName: partnerName.trim() || undefined,
      });
      setSent(true);
    } catch (error) {
      setNotice(serverMessageOf(error) ?? c.events.registrationError);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={enterItem(0)} style={styles.card}>
          <Text style={type.h3}>{detail.title}</Text>
          {detail.locationName ? <Text style={type.bodySm}>{detail.locationName}</Text> : null}
        </Animated.View>

        <Animated.View entering={enterItem(1)} style={styles.section}>
          <Text style={type.eyebrow}>{c.events.categoryLabel}</Text>
          {categories.map((category) => {
            const selected = category.id === categoryId;
            const selectable = isSelectable(category);
            return (
              <PressableScale
                key={category.id}
                disabled={!selectable || sending}
                onPress={() => setCategoryId(category.id)}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !selectable }}
                accessibilityLabel={category.name}
              >
                <View style={[styles.category, selected && styles.categorySelected, !selectable && styles.categoryDisabled]}>
                  <View style={styles.categoryText}>
                    <Text style={type.label}>{category.name}</Text>
                    <Text style={type.caption}>
                      {category.ageGroup}
                      {category.entryFee !== undefined ? ` · ${c.events.entryFee}: ${price(category.entryFee, locale)}` : ''}
                    </Text>
                  </View>
                  <Text style={type.caption}>
                    {category.spotsLeft !== undefined ? plural(c.common.counts.spotsLeft, category.spotsLeft, locale) : ''}
                  </Text>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selected ? colors.accentBright : colors.text3}
                  />
                </View>
              </PressableScale>
            );
          })}
        </Animated.View>

        <Animated.View entering={enterItem(2)} style={styles.section}>
          <Text style={type.eyebrow}>{c.events.athleteBirthDate}</Text>
          <TextInput
            value={birthDate}
            onChangeText={(next) => setBirthDate(next.replace(/[^\d-]/g, '').slice(0, 10))}
            placeholder={c.events.birthDatePlaceholder}
            placeholderTextColor={colors.text3}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            maxLength={10}
            editable={!sending}
            style={styles.input}
          />
          {birthDateComplete && !birthDateValid ? <Text style={[type.caption, styles.error]}>{c.events.invalidBirthDate}</Text> : null}
        </Animated.View>

        <Animated.View entering={enterItem(3)} style={styles.section}>
          <Text style={type.eyebrow}>{c.events.partnerName}</Text>
          <TextInput
            value={partnerName}
            onChangeText={(next) => setPartnerName(next.slice(0, 160))}
            placeholderTextColor={colors.text3}
            editable={!sending}
            style={styles.input}
          />
        </Animated.View>

        <Button label={c.events.submitRegistration} onPress={onSubmit} busy={sending} disabled={!canSubmit} />

        {notice ? (
          <Animated.View entering={enterItem(4)} style={styles.noticeCard}>
            <Text style={[type.bodySm, styles.error]}>{notice}</Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.lg },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  section: { gap: space.sm },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  categorySelected: { borderColor: colors.accentBright },
  categoryDisabled: { opacity: 0.4 },
  categoryText: { flex: 1, gap: 2 },
  input: {
    ...type.body,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  error: { color: colors.danger },
  noticeCard: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)' },
});
