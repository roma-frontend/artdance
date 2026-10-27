import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getCatalogDetail } from '@/lib/catalog';
import {
  ageFitsCategory,
  bookEvent,
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
import { paymentOutcomeText, startPayment } from '@/lib/payment-url';
import { payBooking } from '@/lib/bookings';
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
  const [detail, setDetail] = useCachedState<CompetitionEventDetail>(`content.event.${slug}`, 'public');
  const [failed, setFailed] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [successText, setSuccessText] = useState<string | null>(null);

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
      <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
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
    return shell(<EmptyState icon="checkmark-circle-outline" title={successText ?? c.events.registrationSuccess} />);
  }

  const categories = detail.competitionCategories ?? [];
  const eventOpen = isRegistrationOpen(detail) && Date.parse(detail.startsAt) > Date.now();
  const event = detail;

  if (detail.type !== 'COMPETITION') {
    if (!eventOpen) return shell(<EmptyState icon="lock-closed-outline" title={c.events.registrationClosed} />);
    if (typeof detail.spotsLeft === 'number' && detail.spotsLeft <= 0) {
      return shell(<EmptyState icon="people-outline" title={c.events.eventFull} />);
    }

    async function bookRegularEvent() {
      if (sending) return;
      setSending(true);
      setNotice(null);
      try {
        const result = await bookEvent(event.slug);
        if (result.booking.totalPrice > 0) {
          try {
            const payment = await payBooking(result.booking.id, 'CARD');
            const outcome = await startPayment(payment);
            if (outcome !== 'UNAVAILABLE') {
              setSuccessText(paymentOutcomeText(outcome, t));
              setSent(true);
              return;
            }
          } catch {
            // The booking remains in the account and can be paid from its pass screen.
          }
        }
        router.replace({ pathname: '/booking/[id]/pass', params: { id: result.booking.id } });
      } catch (error) {
        setNotice(serverMessageOf(error) ?? c.events.bookingError);
      } finally {
        setSending(false);
      }
    }

    return shell(
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enterItem(0)} style={styles.card}>
          <Text style={type.h3}>{event.title}</Text>
          {event.locationName ? <Text style={type.bodySm}>{event.locationName}</Text> : null}
          {event.price !== undefined ? <Text style={type.bodySm}>{event.price > 0 ? price(event.price, locale) : c.events.freeEntry}</Text> : null}
          {event.spotsLeft !== undefined ? (
            <Text style={type.bodySm}>{plural(c.common.counts.spotsLeft, event.spotsLeft, locale)}</Text>
          ) : null}
        </Animated.View>
        <Button label={c.events.bookCta} onPress={bookRegularEvent} busy={sending} />
        {notice ? (
          <Animated.View entering={enterItem(1)} style={styles.noticeCard} accessibilityLiveRegion="polite">
            <Text style={[type.bodySm, styles.error]}>{notice}</Text>
          </Animated.View>
        ) : null}
      </ScrollView>,
    );
  }

  if (detail.type !== 'COMPETITION' || categories.length === 0) {
    return shell(<EmptyState icon="time-outline" title={c.events.registrationUnavailable} />);
  }

  if (!isRegistrationOpen(detail)) {
    return shell(<EmptyState icon="lock-closed-outline" title={c.events.registrationClosed} />);
  }

  const birthDateComplete = birthDate.length === 10;
  const birthDateValid = isValidBirthDate(birthDate);
  // Возраст считается на дату события, как на сервере; до ввода даты ограничений нет.
  const fitsAge = (category: CompetitionCategory) => !birthDateValid || ageFitsCategory(birthDate, detail.startsAt, category);
  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null;
  const ageMismatch = selectedCategory !== null && !fitsAge(selectedCategory);
  const canSubmit = categoryId !== null && birthDateValid && !ageMismatch && !sending;

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
      setSuccessText(c.events.registrationSuccess);
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
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
        <Animated.View entering={enterItem(0)} style={styles.card}>
          <Text style={type.h3}>{detail.title}</Text>
          {detail.locationName ? <Text style={type.bodySm}>{detail.locationName}</Text> : null}
        </Animated.View>

        <Animated.View entering={enterItem(1)} style={styles.section}>
          <Text style={type.eyebrow}>{c.events.categoryLabel}</Text>
          {categories.map((category) => {
            const selected = category.id === categoryId;
            const selectable = isSelectable(category) && fitsAge(category);
            return (
              <PressableScale
                key={category.id}
                disabled={!selectable || sending}
                onPress={() => setCategoryId(category.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: !selectable }}
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
          <DateTimeField
            mode="date"
            label={c.events.athleteBirthDate}
            value={birthDate}
            onChange={setBirthDate}
            placeholder={c.events.birthDatePlaceholder}
            maximumDate={new Date()}
            disabled={sending}
            error={birthDateComplete && !birthDateValid ? c.events.invalidBirthDate : ageMismatch ? c.events.ageNotEligible : null}
          />
        </Animated.View>

        <Animated.View entering={enterItem(3)} style={styles.section}>
          <Text style={type.eyebrow}>{c.events.partnerName}</Text>
          <TextInput
            value={partnerName}
            onChangeText={(next) => setPartnerName(next.slice(0, 160))}
            accessibilityLabel={c.events.partnerName}
            placeholderTextColor={colors.text3}
            editable={!sending}
            style={styles.input}
          />
        </Animated.View>

        <Button label={c.events.submitRegistration} onPress={onSubmit} busy={sending} disabled={!canSubmit} />

        {notice ? (
          <Animated.View entering={enterItem(4)} style={styles.noticeCard} accessibilityLiveRegion="polite">
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
