import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getBookingConsents } from '@/lib/bookings';
import { bookingConsentForm, buildConsentBody, consentErrorField, type BookingConsentId, type BookingConsentRules, type ConsentField } from '@/lib/booking-consents';
import { createRentalBooking, getRentalOptions, RentalsError, type RentalOptions } from '@/lib/rentals';
import { price } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { serverMessageOf } from '@/lib/server-message';
import { EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

const YEREVAN_OFFSET = '+04:00';
const YEREVAN_MS = 4 * 60 * 60 * 1000;

function yerevanDate(now = Date.now()): string {
  return new Date(now + YEREVAN_MS).toISOString().slice(0, 10);
}

function durationOptions(options: RentalOptions): number[] {
  const values: number[] = [];
  for (let minutes = options.rules.minMinutes; minutes <= options.rules.maxMinutes; minutes += options.rules.granularityMinutes) values.push(minutes);
  return values;
}

function rentalPrice(pricePerHour: number, minutes: number): number {
  return Math.round((pricePerHour * minutes) / 60);
}

export default function StudioBookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [options, setOptions] = useCachedState<RentalOptions>(`content.studio.${slug}`, 'public');
  const [failed, setFailed] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [date, setDate] = useState(yerevanDate());
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentRules, setConsentRules] = useState<BookingConsentRules | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [consentChecked, setConsentChecked] = useState<BookingConsentId[]>([]);
  const [consentError, setConsentError] = useState<{ field: ConsentField; text: string } | null>(null);

  // Правила согласий грузим один раз. Пока их нет, формы согласий нет, и сервер проверит бронь сам.
  useEffect(() => {
    let alive = true;
    getBookingConsents()
      .then((rules) => {
        if (alive) setConsentRules(rules);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getRentalOptions(slug)
      .then((next) => {
        if (!alive) return;
        setOptions(next);
        setRoomId(next.venue.rooms[0]?.id ?? '');
        setDuration(next.rules.minMinutes);
      })
      .catch((next: unknown) => {
        if (alive) setFailed(serverMessageOf(next) ?? t.catalogError);
      });
    return () => {
      alive = false;
    };
  }, [slug, t.catalogError]);

  const room = options?.venue.rooms.find((item) => item.id === roomId) ?? null;
  const durations = useMemo(() => (options ? durationOptions(options) : []), [options]);
  const total = room ? rentalPrice(room.pricePerHour, duration) : 0;
  const minDate = new Date(`${yerevanDate()}T00:00:00${YEREVAN_OFFSET}`);
  const consentForm = bookingConsentForm({ rules: consentRules, subject: 'STUDIO_RENTAL', birthDate, checked: consentChecked, today: yerevanDate() });
  const consentFields = buildConsentBody(consentForm, birthDate);
  const birthDateError =
    consentError?.field === 'participantBirthDate' ? consentError.text : consentForm.birthDateInvalid ? c.validation.invalidDate : null;

  function toggleConsent(id: BookingConsentId) {
    setConsentError(null);
    setConsentChecked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function submit() {
    if (busy || !consentForm.ready) return;
    if (!room || !date || !time) {
      setError(c.studio.rent.invalid);
      return;
    }
    const startsAt = new Date(`${date}T${time}:00${YEREVAN_OFFSET}`);
    if (Number.isNaN(startsAt.getTime())) {
      setError(c.studio.rent.invalid);
      return;
    }
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);
    setBusy(true);
    setError(null);
    setConsentError(null);
    try {
      const result = await createRentalBooking({
        roomId: room.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        durationMinutes: duration,
        consentFields,
      });
      router.replace({ pathname: '/booking/[id]/pass', params: { id: result.booking.id } });
    } catch (next: unknown) {
      const consentField = consentErrorField(next instanceof RentalsError ? next.field : null);
      if (consentField && consentForm.active) {
        // Сервер отверг согласия или дату: подсвечиваем своё поле рядом с ним.
        setConsentError({
          field: consentField,
          text: serverMessageOf(next) ?? (consentField === 'consents' ? c.booking.consent.required : c.validation.invalidDate),
        });
        return;
      }
      setError(serverMessageOf(next) ?? c.studio.rent.error);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={type.h2}>{c.studio.rent.title}</Text>
    </Animated.View>
  );

  if (failed !== null) {
    return <View style={[styles.screen, { paddingTop: insets.top }]}>{header}<EmptyState icon="alert-circle-outline" title={failed} /></View>;
  }
  if (!options) {
    return <View style={[styles.screen, { paddingTop: insets.top }]}>{header}<View style={styles.center}><ActivityIndicator color={colors.accentBright} /></View></View>;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={type.bodySm}>{options.venue.name}</Text>
        <Text style={type.bodySm}>{c.studio.rent.subtitle}</Text>

        <View style={styles.section}>
          <Text style={type.eyebrow}>{c.studio.rent.roomLabel}</Text>
          {options.venue.rooms.map((item) => {
            const selected = item.id === roomId;
            return (
              <PressableScale key={item.id} onPress={() => setRoomId(item.id)} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                <View style={[styles.option, selected && styles.optionSelected]}>
                  <View style={styles.flex}>
                    <Text style={type.label}>{item.name}</Text>
                    <Text style={type.caption}>{c.studio.capacityNote.replace('{count}', String(item.capacity))} · {price(item.pricePerHour, locale)} / {c.common.labels.perHour}</Text>
                  </View>
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.accentBright : colors.text3} />
                </View>
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.row}>
          <DateTimeField mode="date" label={c.studio.rent.dateLabel} value={date} onChange={setDate} minimumDate={minDate} disabled={busy} />
          <DateTimeField mode="time" label={c.studio.rent.timeLabel} value={time} onChange={setTime} disabled={busy} />
        </View>

        <View style={styles.section}>
          <Text style={type.eyebrow}>{c.studio.rent.durationLabel}</Text>
          <View style={styles.chips}>
            {durations.map((minutes) => {
              const selected = minutes === duration;
              return (
                <PressableScale key={minutes} onPress={() => setDuration(minutes)} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                  <View style={[styles.chip, selected && styles.chipSelected]}><Text style={type.caption}>{c.studio.rent.durationOption.replace('{minutes}', String(minutes))}</Text></View>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {consentForm.active ? (
          <View style={styles.section}>
            <Text style={type.eyebrow}>{c.booking.consent.title}</Text>
            <View style={[styles.consentCard, consentError?.field === 'consents' && styles.consentCardError]}>
              <DateTimeField
                mode="date"
                label={c.booking.consent.birthDateLabel}
                value={birthDate}
                onChange={(value) => {
                  setBirthDate(value);
                  setConsentError(null);
                }}
                placeholder={c.events.birthDatePlaceholder}
                maximumDate={new Date()}
                disabled={busy}
                error={birthDateError}
              />
              <Text style={type.caption}>{c.booking.consent.birthDateHint}</Text>
              {consentForm.ids.map((id) => {
                const checked = consentForm.acceptedIds.includes(id);
                return (
                  <PressableScale
                    key={id}
                    pressedScale={0.98}
                    onPress={() => toggleConsent(id)}
                    disabled={busy}
                    style={styles.consentRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: busy }}
                  >
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.accentBright : colors.text3} />
                    <Text style={[type.bodySm, styles.flex]}>{c.booking.consent.items[id]}</Text>
                  </PressableScale>
                );
              })}
              {consentForm.draft ? <Text style={type.caption}>{c.booking.consent.draftNotice}</Text> : null}
              {consentError?.field === 'consents' ? (
                <Text style={[type.caption, styles.consentErrorText]} accessibilityRole="alert">
                  {consentError.text}
                </Text>
              ) : consentForm.ids.length > 0 && !consentForm.ready ? (
                <Text style={type.caption}>{c.booking.consent.required}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.total}>
          <Text style={type.bodySm}>{c.studio.rent.total}</Text>
          <Text style={type.h2}>{price(total, locale)}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={c.studio.rent.submit} onPress={submit} busy={busy} disabled={busy || !room || !consentForm.ready} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.lg },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.md },
  section: { gap: space.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.accentBright },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  chipSelected: { borderColor: colors.accentBright, backgroundColor: colors.accentSoft },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space.md },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  consentCard: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  consentCardError: { borderColor: colors.danger },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44, paddingVertical: 4 },
  consentErrorText: { color: colors.danger, fontWeight: '600' },
});
