import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { dateLabel, plural } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { listBookingRequests, respondToBookingRequest, type BookingRequest } from '@/lib/studio-insights';
import { colors, radius, space, type } from '@/theme';

const WHEN_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };

/** Заявки инструктора: принять или отклонить до срока ответа. Ответ уходит на сервер, он решает. */
export default function StudioRequestsScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const s = c.studio.requests;
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listBookingRequests();
      setRequests(data.requests);
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? s.error);
    } finally {
      setLoaded(true);
    }
  }, [s.error]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function respond(request: BookingRequest, decision: 'ACCEPT' | 'DECLINE') {
    setBusyId(request.id);
    setActionError(null);
    try {
      await respondToBookingRequest(request.id, decision, decision === 'DECLINE' ? reason : undefined);
      setDecliningId(null);
      setReason('');
      setRequests((list) => list.filter((item) => item.id !== request.id));
    } catch (error) {
      setActionError(serverMessageOf(error) ?? s.error);
    } finally {
      setBusyId(null);
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
      ) : requests.length === 0 ? (
        <EmptyState icon="calendar-outline" title={s.empty} body={s.subtitle} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
        >
          <Text style={type.bodySm}>{s.subtitle}</Text>
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

          {requests.map((request, index) => {
            const declining = decliningId === request.id;
            const busy = busyId === request.id;
            return (
              <Animated.View key={request.id} entering={FadeInDown.delay(index * 60).duration(420).easing(EASE_OUT)} style={styles.card}>
                <Text style={type.h3}>{request.className ?? request.customerName}</Text>
                <Text style={type.bodySm}>{request.customerName}</Text>
                <Text style={type.bodySm}>
                  {dateLabel(request.startsAt, locale, WHEN_OPTIONS)} — {dateLabel(request.endsAt, locale, { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={type.bodySm}>{plural(s.participants, request.participants, locale)}</Text>
                <Text style={type.label}>{s.deadline.replace('{when}', dateLabel(request.requestExpiresAt, locale, WHEN_OPTIONS))}</Text>

                {declining ? (
                  <View style={styles.declineBox}>
                    <Text style={type.label}>{s.reasonLabel}</Text>
                    <TextInput
                      value={reason}
                      onChangeText={setReason}
                      multiline
                      maxLength={500}
                      accessibilityLabel={s.reasonLabel}
                      style={styles.input}
                    />
                    <View style={styles.row}>
                      <Button label={s.confirmDecline} onPress={() => void respond(request, 'DECLINE')} busy={busy} disabled={busy} />
                      <Button label={s.back} variant="ghost" onPress={() => setDecliningId(null)} disabled={busy} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <Button label={s.accept} onPress={() => void respond(request, 'ACCEPT')} busy={busy} disabled={busy} />
                    <Button
                      label={s.decline}
                      variant="ghost"
                      onPress={() => {
                        setReason('');
                        setDecliningId(request.id);
                      }}
                      disabled={busy}
                    />
                  </View>
                )}
              </Animated.View>
            );
          })}
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
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  declineBox: { gap: space.sm, marginTop: space.sm },
  input: { minHeight: 64, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: 'rgba(245,241,234,0.12)', borderRadius: radius.sm, padding: space.md },
  error: { color: colors.danger, fontSize: 13 },
});
