import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { dateLabel, price } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { boostBid, listBoosts, requestBoost, type BoostCampaign } from '@/lib/studio-insights';
import { colors, radius, space, type } from '@/theme';

const DAY_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
const TIME_OPTIONS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/** Буст: заявка на промо-размещение инструктора. Вступает в силу после одобрения админом. */
export default function StudioBoostScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const s = c.boost.studio;
  const insets = useSafeAreaInsets();

  const [enabled, setEnabled] = useState(false);
  const [campaigns, setCampaigns] = useState<BoostCampaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [bid, setBid] = useState(String(boostBid.min));
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listBoosts();
      setEnabled(data.enabled);
      setCampaigns(data.campaigns);
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? c.errors.generic.description);
    } finally {
      setLoaded(true);
    }
  }, [c.errors.generic.description]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const bidNumber = Number(bid);
  const bidValid = Number.isInteger(bidNumber) && bidNumber >= boostBid.min && bidNumber <= boostBid.max && bidNumber % boostBid.step === 0;
  const startsAt = startDate && startTime ? new Date(`${startDate}T${startTime}:00`) : null;
  const endsAt = endDate && endTime ? new Date(`${endDate}T${endTime}:00`) : null;
  const periodValid = startsAt !== null && endsAt !== null && endsAt.getTime() > startsAt.getTime();
  const ready = bidValid && periodValid && !sending;

  async function submit() {
    if (!startsAt || !endsAt || !ready) return;
    setSending(true);
    setNotice(null);
    try {
      await requestBoost({ bidAmount: bidNumber, startsAt, endsAt });
      setNotice({ ok: true, text: s.requested });
      await load();
    } catch (error) {
      setNotice({ ok: false, text: serverMessageOf(error) ?? c.errors.generic.description });
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {s.title}
        </Text>
      </Animated.View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        >
          <Text style={type.bodySm}>{s.intro}</Text>
          {!enabled ? <Text style={type.bodySm}>{s.notIncluded}</Text> : null}

          {enabled ? (
            <View style={styles.card}>
              <Text style={type.h3}>{s.newRequest}</Text>
              <Text style={type.label}>{s.bid}</Text>
              <TextInput
                value={bid}
                onChangeText={(text) => setBid(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                accessibilityLabel={s.bid}
                style={styles.input}
              />
              <Text style={type.caption}>{s.bidHint.replace('{min}', String(boostBid.min)).replace('{max}', String(boostBid.max))}</Text>

              <DateTimeField label={s.start} mode="date" value={startDate} onChange={setStartDate} />
              <DateTimeField label={s.start} mode="time" value={startTime} onChange={setStartTime} />
              <DateTimeField label={s.end} mode="date" value={endDate} onChange={setEndDate} />
              <DateTimeField label={s.end} mode="time" value={endTime} onChange={setEndTime} />

              <View style={styles.row}>
                <Button label={s.submit} onPress={() => void submit()} busy={sending} disabled={!ready} />
              </View>
              {notice ? <Text style={[styles.notice, { color: notice.ok ? colors.success : colors.danger }]}>{notice.text}</Text> : null}
            </View>
          ) : null}

          <Text style={type.eyebrow}>{s.history}</Text>
          {campaigns.length === 0 ? (
            <Text style={type.bodySm}>{s.empty}</Text>
          ) : (
            campaigns.map((campaign, index) => (
              <Animated.View key={campaign.id} entering={FadeInDown.delay(index * 50).duration(420).easing(EASE_OUT)} style={styles.card}>
                <Text style={type.label}>{c.boost.status[campaign.status]}</Text>
                <Text style={type.bodySm}>{s.bidLabel.replace('{amount}', price(campaign.bidAmount, locale).replace('֏', '').trim())}</Text>
                <Text style={type.bodySm}>
                  {dateLabel(campaign.startsAt, locale, DAY_OPTIONS)} {dateLabel(campaign.startsAt, locale, TIME_OPTIONS)} —{' '}
                  {dateLabel(campaign.endsAt, locale, DAY_OPTIONS)} {dateLabel(campaign.endsAt, locale, TIME_OPTIONS)}
                </Text>
              </Animated.View>
            ))
          )}
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: { height: 44, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: 'rgba(245,241,234,0.12)', borderRadius: radius.sm, paddingHorizontal: space.md },
  notice: { fontSize: 13 },
});
