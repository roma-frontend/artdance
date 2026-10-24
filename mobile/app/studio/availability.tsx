import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { yerevanClock, yerevanDate } from '@/lib/class-time';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT, enterItem } from '@/lib/motion';
import { serverMessageOf } from '@/lib/server-message';
import {
  deleteEntry,
  getAvailability,
  saveException,
  saveRule,
  setRuleActive,
  type AvailabilitySnapshot,
  type ExceptionDraft,
  type RuleDraft,
} from '@/lib/studio';
import { colors, radius, space, type } from '@/theme';

type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Порядок недели с понедельника. `weekday` соответствует серверу: 0 = воскресенье. */
const WEEK: { weekday: number; key: WeekdayKey }[] = [
  { weekday: 1, key: 'mon' },
  { weekday: 2, key: 'tue' },
  { weekday: 3, key: 'wed' },
  { weekday: 4, key: 'thu' },
  { weekday: 5, key: 'fri' },
  { weekday: 6, key: 'sat' },
  { weekday: 0, key: 'sun' },
];

const DAY_KEY: Record<number, WeekdayKey> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

const EMPTY_RULE: RuleDraft = { weekday: 1, startTime: '', endTime: '', validFrom: '', validUntil: '' };
const EMPTY_EXCEPTION: ExceptionDraft = { date: '', startTime: '', endTime: '', isAvailable: false, reason: '' };

const DANGER = '#E36A6A';

/** Время расписания — Ереван, как и на сервере. */
function wallTime(iso: string) {
  return yerevanClock(Date.parse(iso));
}

function wallDay(iso: string) {
  return yerevanDate(Date.parse(iso));
}

/**
 * Расписание инструктора: недельные окна и разовые исключения.
 * Зеркалит веб `/studio/availability`. Все записи идут через `/api/studio/availability`.
 */
export default function AvailabilityScreen() {
  const c = catalogFor(deviceLocale(undefined));
  const a = c.studio.availability;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<AvailabilitySnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rule, setRule] = useState<RuleDraft>(EMPTY_RULE);
  const [exception, setException] = useState<ExceptionDraft>(EMPTY_EXCEPTION);

  const load = useCallback(async () => {
    try {
      setSnapshot(await getAvailability());
      setLoadError(null);
    } catch (error) {
      setLoadError(serverMessageOf(error) ?? a.error);
    }
  }, [a.error]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Выполняет запись, сбрасывает форму при успехе и перечитывает расписание. */
  async function run(action: () => Promise<void>, onDone?: () => void) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await action();
      onDone?.();
      setNotice({ ok: true, text: a.saved });
      await load();
    } catch (error) {
      setNotice({ ok: false, text: serverMessageOf(error) ?? a.error });
    } finally {
      setBusy(false);
    }
  }

  if (snapshot === null && loadError === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {a.title}
        </Text>
      </Animated.View>

      {loadError !== null || snapshot === null ? (
        <EmptyState icon="alert-circle-outline" title={loadError ?? a.error} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={type.bodySm}>{a.subtitle}</Text>

          {notice && (
            <View style={[styles.card, { borderColor: notice.ok ? colors.accentBright : DANGER, borderWidth: 1 }]}>
              <Text style={type.bodySm}>{notice.text}</Text>
            </View>
          )}

          {/* Недельные окна */}
          <Text style={type.h3}>{a.rulesTitle}</Text>
          <Text style={type.caption}>{a.rulesHint}</Text>
          {snapshot.rules.length === 0 ? (
            <Text style={type.caption}>{a.rulesEmpty}</Text>
          ) : (
            snapshot.rules.map((item, i) => {
              const validity =
                item.validFrom || item.validUntil ? ` · ${item.validFrom ?? '…'} — ${item.validUntil ?? '…'}` : '';
              return (
                <Animated.View key={item.id} entering={enterItem(i)} style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={type.h3}>{c.studio.availability.weekday[DAY_KEY[item.weekday] ?? 'mon']}</Text>
                    <View style={styles.rowGap}>
                      <Text style={type.caption}>{a.active}</Text>
                      <Switch
                        value={item.isActive}
                        disabled={busy}
                        onValueChange={(next) => void run(() => setRuleActive(item.id, next))}
                        trackColor={{ false: 'rgba(245,241,234,0.2)', true: colors.accentBright }}
                      />
                    </View>
                  </View>
                  <Text style={type.bodySm}>{`${item.startTime}–${item.endTime}${validity}`}</Text>
                  <PressableScale
                    onPress={() => {
                      if (!busy) void run(() => deleteEntry('rule', item.id));
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.danger}>{a.delete}</Text>
                  </PressableScale>
                </Animated.View>
              );
            })
          )}

          <View style={styles.form}>
            <Text style={type.caption}>{a.weekdayLabel}</Text>
            <View style={styles.chips}>
              {WEEK.map((day) => (
                <Chip
                  key={day.weekday}
                  label={c.studio.availability.weekday[day.key].slice(0, 3)}
                  selected={rule.weekday === day.weekday}
                  onPress={() => setRule((prev) => ({ ...prev, weekday: day.weekday }))}
                />
              ))}
            </View>
            <View style={styles.pair}>
              <Field
                label={a.startTime}
                value={rule.startTime}
                placeholder="09:00"
                onChangeText={(v) => setRule((prev) => ({ ...prev, startTime: v }))}
              />
              <Field
                label={a.endTime}
                value={rule.endTime}
                placeholder="12:00"
                onChangeText={(v) => setRule((prev) => ({ ...prev, endTime: v }))}
              />
            </View>
            <View style={styles.pair}>
              <Field
                label={a.validFrom}
                value={rule.validFrom}
                placeholder="YYYY-MM-DD"
                onChangeText={(v) => setRule((prev) => ({ ...prev, validFrom: v }))}
              />
              <Field
                label={a.validUntil}
                value={rule.validUntil}
                placeholder="YYYY-MM-DD"
                onChangeText={(v) => setRule((prev) => ({ ...prev, validUntil: v }))}
              />
            </View>
            <PrimaryButton
              label={a.addRule}
              disabled={busy}
              onPress={() =>
                void run(
                  () => saveRule(rule),
                  () => setRule((prev) => ({ ...prev, startTime: '', endTime: '' })),
                )
              }
            />
          </View>

          {/* Разовые исключения */}
          <Text style={type.h3}>{a.exceptionsTitle}</Text>
          <Text style={type.caption}>{a.exceptionsHint}</Text>
          {snapshot.exceptions.length === 0 ? (
            <Text style={type.caption}>{a.exceptionsEmpty}</Text>
          ) : (
            snapshot.exceptions.map((item, i) => (
              <Animated.View key={item.id} entering={enterItem(i)} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={type.h3}>{`${wallDay(item.startsAt)} · ${wallTime(item.startsAt)}–${wallTime(item.endsAt)}`}</Text>
                </View>
                <Text style={type.caption}>{item.isAvailable ? a.extraWindow : a.blocked}</Text>
                {item.reason ? <Text style={type.bodySm}>{item.reason}</Text> : null}
                <PressableScale
                  onPress={() => {
                    if (!busy) void run(() => deleteEntry('exception', item.id));
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.danger}>{a.delete}</Text>
                </PressableScale>
              </Animated.View>
            ))
          )}

          <View style={styles.form}>
            <Field
              label={a.date}
              value={exception.date}
              placeholder="YYYY-MM-DD"
              onChangeText={(v) => setException((prev) => ({ ...prev, date: v }))}
            />
            <View style={styles.pair}>
              <Field
                label={a.startTime}
                value={exception.startTime}
                placeholder="09:00"
                onChangeText={(v) => setException((prev) => ({ ...prev, startTime: v }))}
              />
              <Field
                label={a.endTime}
                value={exception.endTime}
                placeholder="12:00"
                onChangeText={(v) => setException((prev) => ({ ...prev, endTime: v }))}
              />
            </View>
            <View style={styles.chips}>
              <Chip
                label={a.blocked}
                selected={!exception.isAvailable}
                onPress={() => setException((prev) => ({ ...prev, isAvailable: false }))}
              />
              <Chip
                label={a.extraWindow}
                selected={exception.isAvailable}
                onPress={() => setException((prev) => ({ ...prev, isAvailable: true }))}
              />
            </View>
            <Field
              label={a.reason}
              value={exception.reason}
              onChangeText={(v) => setException((prev) => ({ ...prev, reason: v }))}
            />
            <PrimaryButton
              label={a.addException}
              disabled={busy}
              onPress={() => void run(() => saveException(exception), () => setException(EMPTY_EXCEPTION))}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button">
      <View style={[styles.chip, selected && styles.chipOn]}>
        <Text style={[type.caption, selected && styles.chipOnText]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={type.caption}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={() => {
        if (!disabled) onPress();
      }}
      accessibilityRole="button"
    >
      <View style={[styles.button, disabled && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  title: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  danger: { color: DANGER },
  form: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.04)', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245,241,234,0.2)',
  },
  chipOn: { backgroundColor: colors.accentBright, borderColor: colors.accentBright },
  chipOnText: { color: colors.bg },
  pair: { flexDirection: 'row', gap: space.sm },
  field: { flex: 1, gap: space.xs },
  input: {
    color: colors.text,
    borderWidth: 1,
    borderColor: 'rgba(245,241,234,0.14)',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  button: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: colors.accentBright },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.bg, fontWeight: '600' },
});
