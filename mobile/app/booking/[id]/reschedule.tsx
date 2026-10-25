import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { getMyBooking, listAvailableSlots, rescheduleMyBooking, type Slot } from '@/lib/bookings';
import { dateLabel, studioDayKey } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

const dayKey = studioDayKey;

const dayOptions: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
const whenOptions: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };

export default function RescheduleScreen() {
  const { id, instructor } = useLocalSearchParams<{ id: string; instructor: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    // Слоты берутся у инструктора самой брони, длительность — как у исходного занятия.
    getMyBooking(id)
      .then(async (booking) => {
        const list = await listAvailableSlots(booking.instructorSlug ?? instructor);
        if (!alive) return;
        setDurationMs(Date.parse(booking.endsAt) - Date.parse(booking.startsAt));
        setSlots(list);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [id, instructor]);

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots ?? []) {
      const key = dayKey(slot.startIso);
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return [...map.entries()].map(([key, list]) => ({ key, iso: list[0].startIso, slots: list }));
  }, [slots]);

  const activeDay = days.find((d) => d.key === day) ?? days[0];

  async function confirm() {
    if (!selected || busy || durationMs === null) return;
    setBusy(true);
    try {
      const newEndsAt = new Date(Date.parse(selected.startIso) + durationMs).toISOString();
      await rescheduleMyBooking(id, { newStartsAt: selected.startIso, newEndsAt });
      Alert.alert(c.booking.confirmedTitle, c.booking.confirmedSubtitle.replace('{when}', dateLabel(selected.startIso, locale, whenOptions)), [
        { text: c.common.actions.continue, onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(serverMessageOf(error) ?? c.booking.conflictError);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <View style={styles.header}>
      <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.catalogBack}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={type.h2}>{c.booking.rescheduleTitle}</Text>
    </View>
  );

  if (loadFailed) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <EmptyState icon="cloud-offline-outline" title={t.catalogError} actionLabel={t.catalogBack} onAction={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {slots === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accentBright} />
          </View>
        ) : days.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" title={t.bookNoSlots} />
        ) : (
          <>
            <Text style={type.eyebrow}>{c.common.labels.date}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {days.map((d) => {
                const active = d.key === activeDay?.key;
                return (
                  <PressableScale
                    key={d.key}
                    onPress={() => {
                      setDay(d.key);
                      setSelected(null);
                    }}
                    style={[styles.day, active && styles.dayActive]}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.dayText, active && styles.dayTextActive]}>{dateLabel(d.iso, locale, dayOptions)}</Text>
                  </PressableScale>
                );
              })}
            </ScrollView>

            <Text style={[type.eyebrow, styles.sectionGap]}>{t.bookPickSlot}</Text>
            <View style={styles.times}>
              {activeDay?.slots.map((slot) => {
                const active = selected?.startIso === slot.startIso;
                return (
                  <PressableScale
                    key={slot.startIso}
                    onPress={() => setSelected(slot)}
                    style={[styles.time, active && styles.timeActive]}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.timeText, active && styles.timeTextActive]}>{slot.startTime}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Text style={[type.caption, styles.flex]} numberOfLines={1}>
          {selected ? `${dateLabel(selected.startIso, locale, dayOptions)} · ${selected.startTime}` : '—'}
        </Text>
        <Button label={t.bookConfirm} onPress={confirm} busy={busy} disabled={!selected} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.md },
  sectionGap: { marginTop: 28 },
  dayRow: { flexDirection: 'row', gap: 10 },
  day: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  dayActive: { backgroundColor: colors.text, borderColor: colors.text },
  dayText: { fontSize: 14, fontWeight: '700', color: colors.text },
  dayTextActive: { color: colors.bg },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  time: {
    width: '31%',
    flexGrow: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  timeActive: { backgroundColor: colors.text, borderColor: colors.text },
  timeText: { fontSize: 17, fontWeight: '800', color: colors.text },
  timeTextActive: { color: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingTop: 14,
    paddingHorizontal: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
  },
});
