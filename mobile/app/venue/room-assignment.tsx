import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { dateLabel } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { getRoomAssignment, assignSessionRoom, type RoomAssignmentSnapshot } from '@/lib/partner-dashboards';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

export default function RoomAssignmentScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [assignment, setAssignment] = useState<RoomAssignmentSnapshot | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setFailed(c.errors.notFound.description);
      return;
    }
    let alive = true;
    getRoomAssignment(sessionId)
      .then((next) => {
        if (!alive) return;
        setAssignment(next);
        setFailed(null);
      })
      .catch((error) => {
        if (alive) setFailed(serverMessageOf(error) ?? c.errors.generic.description);
      });
    return () => {
      alive = false;
    };
  }, [sessionId, c.errors.generic.description, c.errors.notFound.description]);

  async function save(roomId: string | null) {
    if (!sessionId || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      await assignSessionRoom({ sessionId, roomId });
      setAssignment((current) => (current ? { ...current, session: { ...current.session, roomId } } : current));
      setNotice(c.footer.venueDashboardRoomSaved);
    } catch (error) {
      setNotice(serverMessageOf(error) ?? c.footer.venueDashboardRoomError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {c.footer.venueDashboardRoomLabel}
        </Text>
      </Animated.View>

      {failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : assignment === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.sessionCard}>
            <Text style={type.h3}>{assignment.session.title}</Text>
            <Text style={type.bodySm}>{assignment.session.venue.name}</Text>
            <Text style={type.bodySm}>
              {dateLabel(assignment.session.startsAt, locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {dateLabel(assignment.session.endsAt, locale, { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <Text style={type.bodySm}>{c.footer.venueDashboardSessionsHint}</Text>

          <PressableScale
            onPress={() => void save(null)}
            disabled={saving}
            accessibilityRole="radio"
            accessibilityState={{ checked: assignment.session.roomId === null, disabled: saving }}
          >
            <View style={[styles.option, assignment.session.roomId === null && styles.selected]}>
              <View style={styles.optionText}>
                <Text style={type.label}>{c.footer.venueDashboardNoRoom}</Text>
                <Text style={type.caption}>{c.footer.venueDashboardRoomLabel}</Text>
              </View>
              <Ionicons
                name={assignment.session.roomId === null ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={assignment.session.roomId === null ? colors.accentBright : colors.text3}
              />
            </View>
          </PressableScale>

          {assignment.rooms.map((room) => {
            const selected = room.id === assignment.session.roomId;
            return (
              <PressableScale
                key={room.id}
                onPress={() => void save(room.id)}
                disabled={saving}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: saving }}
              >
                <View style={[styles.option, selected && styles.selected]}>
                  <View style={styles.optionText}>
                    <Text style={type.label}>{room.name}</Text>
                    <Text style={type.caption}>{c.footer.venueDashboardRoomLabel}</Text>
                  </View>
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.accentBright : colors.text3} />
                </View>
              </PressableScale>
            );
          })}

          {notice ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={[type.bodySm, notice === c.footer.venueDashboardRoomSaved ? styles.success : styles.error]}>{notice}</Text>
            </View>
          ) : null}
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
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  sessionCard: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  selected: { borderColor: colors.accentBright, backgroundColor: colors.accentSoft },
  optionText: { flex: 1, gap: 2 },
  notice: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)' },
  success: { color: colors.success },
  error: { color: colors.danger },
});
