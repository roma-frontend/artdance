import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import {
  danceSportPrograms,
  getAthleteCabinet,
  ratingWindowMonths,
  saveAthleteProfile,
  type AthleteCabinet,
  type DanceSportProgram,
} from '@/lib/athlete';
import { dateLabel } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };

/** Профиль атлета: программы, клуб и разряд, рейтинг, достижения и регистрации. */
export default function AthleteScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const a = c.athlete.cabinet;
  const insets = useSafeAreaInsets();

  const [athlete, setAthlete] = useState<AthleteCabinet | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [programs, setPrograms] = useState<DanceSportProgram[]>([]);
  const [clubName, setClubName] = useState('');
  const [rank, setRank] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const applyCabinet = useCallback((next: AthleteCabinet | null) => {
    setAthlete(next);
    setPrograms(next?.programs ?? []);
    setClubName(next?.clubName ?? '');
    setRank(next?.rank ?? '');
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await getAthleteCabinet();
      applyCabinet(data.athlete);
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? c.errors.generic.description);
    } finally {
      setLoaded(true);
    }
  }, [applyCabinet, c.errors.generic.description]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function toggleProgram(program: DanceSportProgram) {
    setPrograms((list) => (list.includes(program) ? list.filter((item) => item !== program) : [...list, program]));
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      await saveAthleteProfile({ programs, clubName, rank });
      setNotice({ ok: true, text: a.saved });
      await load();
    } catch (error) {
      setNotice({ ok: false, text: serverMessageOf(error) ?? c.errors.generic.description });
    } finally {
      setSaving(false);
    }
  }

  const programLabel = (program: DanceSportProgram) => c.dancesport.programs[program.toLowerCase() as 'standard' | 'latine'];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {a.title}
        </Text>
      </Animated.View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : athlete === null ? (
        <EmptyState icon="trophy-outline" title={a.notRegistered} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        >
          <View style={styles.card}>
            <Text style={type.h3}>{a.profileTitle}</Text>
            {athlete.wdsfId ? (
              <Text style={type.bodySm}>
                {a.wdsfId}: {athlete.wdsfId}
              </Text>
            ) : null}

            <Text style={type.label}>{a.programs}</Text>
            <View style={styles.row}>
              {danceSportPrograms.map((program) => {
                const selected = programs.includes(program);
                return (
                  <PressableScale
                    key={program}
                    onPress={() => toggleProgram(program)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected ? styles.chipOn : null]}
                  >
                    <Text style={[type.label, selected ? styles.chipTextOn : null]}>{programLabel(program)}</Text>
                  </PressableScale>
                );
              })}
            </View>

            <Text style={type.label}>{a.club}</Text>
            <TextInput value={clubName} onChangeText={setClubName} maxLength={120} accessibilityLabel={a.club} style={styles.input} />
            <Text style={type.label}>{a.rank}</Text>
            <TextInput value={rank} onChangeText={setRank} maxLength={60} accessibilityLabel={a.rank} style={styles.input} />

            <View style={styles.row}>
              <Button label={a.save} onPress={() => void save()} busy={saving} disabled={saving} />
            </View>
            {notice ? <Text style={[styles.notice, { color: notice.ok ? colors.success : colors.danger }]}>{notice.text}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={type.h3}>{a.ratingTitle}</Text>
            <Text style={type.h2}>{athlete.rating}</Text>
            <Text style={type.bodySm}>{a.ratingNote.replace('{months}', String(ratingWindowMonths))}</Text>

            <Text style={type.eyebrow}>{a.achievementsTitle}</Text>
            {athlete.achievements.length === 0 ? (
              <Text style={type.bodySm}>{a.noAchievements}</Text>
            ) : (
              athlete.achievements.map((item) => (
                <View key={`${item.eventSlug}-${item.categoryName}`} style={styles.rowBetween}>
                  <Text style={[type.bodySm, styles.grow]}>
                    {item.eventTitle} · {item.categoryName}
                    {'\n'}
                    {dateLabel(item.eventStartsAt, locale, DATE_OPTIONS)}
                  </Text>
                  <Text style={type.label}>{c.competitionPlace[item.place]}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={type.h3}>{a.registrationsTitle}</Text>
            {athlete.registrations.length === 0 ? (
              <Text style={type.bodySm}>{a.noRegistrations}</Text>
            ) : (
              athlete.registrations.map((row) => (
                <View key={row.id} style={styles.registration}>
                  <Text style={type.label}>{row.event.title}</Text>
                  <Text style={type.bodySm}>
                    {row.category.name}
                    {row.partnerName ? ` · ${a.partner}: ${row.partnerName}` : ''}
                  </Text>
                  <Text style={type.bodySm}>
                    {dateLabel(row.event.startsAt, locale, DATE_OPTIONS)} · {a.statuses[row.status]}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  title: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(245,241,234,0.12)' },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTextOn: { color: colors.white },
  input: { height: 44, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: 'rgba(245,241,234,0.12)', borderRadius: radius.sm, paddingHorizontal: space.md },
  registration: { gap: 2, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  notice: { fontSize: 13 },
});
