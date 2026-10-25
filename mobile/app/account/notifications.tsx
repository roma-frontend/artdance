import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import {
  loadAccountNotifications,
  setEmailPreference,
  type EmailPreference,
  type NotificationItem,
  type NotificationType,
  type NotificationsState,
} from '@/lib/account-notifications';
import { dateLabel } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

type CatalogCopy = ReturnType<typeof catalogFor>;
type IconName = ComponentProps<typeof Ionicons>['name'];

export default function AccountNotificationsScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<NotificationsState | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await loadAccountNotifications());
      setFailed(null);
    } catch (error) {
      setFailed(serverMessageOf(error) ?? t.catalogError);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function toggle(kind: NotificationType, enabled: boolean) {
    if (!state || pending) return;
    const previous = state.preferences;
    setPending(true);
    // Переключатель меняется сразу; при ошибке возвращаем список, который был до нажатия.
    setState({ ...state, preferences: previous.map((p) => (p.type === kind ? { ...p, enabled } : p)) });
    try {
      const preferences: EmailPreference[] = await setEmailPreference(kind, enabled);
      setState((prev) => (prev ? { ...prev, preferences } : prev));
    } catch (error) {
      setState((prev) => (prev ? { ...prev, preferences: previous } : prev));
      Alert.alert(serverMessageOf(error) ?? t.catalogError);
    } finally {
      setPending(false);
    }
  }

  if (state === null && failed === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.notifications.title}</Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBright} />}
      >
        {state === null ? (
          <EmptyState icon="alert-circle-outline" title={failed ?? t.catalogError} />
        ) : (
          <>
            <Text style={styles.section}>{c.notifications.emailTitle}</Text>
            <Text style={styles.hint}>{c.notifications.emailHint}</Text>
            <View style={styles.card}>
              {state.preferences.map((pref, index) => (
                <View key={pref.type} style={[styles.row, index > 0 && styles.rowDivider]}>
                  <Text style={[type.label, styles.rowLabel]}>{typeLabel(pref.type, c)}</Text>
                  <Switch
                    value={pref.enabled}
                    disabled={pending}
                    onValueChange={(value) => toggle(pref.type, value)}
                    trackColor={{ false: colors.line, true: colors.accent }}
                    thumbColor={colors.text}
                    accessibilityLabel={typeLabel(pref.type, c)}
                  />
                </View>
              ))}
            </View>

            <Text style={styles.section}>{c.notifications.historyTitle}</Text>
            {state.items.length === 0 ? (
              <EmptyState icon="mail-outline" title={c.notifications.historyEmpty} body={c.notifications.historyEmptyHint} />
            ) : (
              state.items.map((item, index) => (
                <Animated.View key={item.id} entering={enterItem(index)} style={styles.item}>
                  <Ionicons name={STATUS_ICON[item.status]} size={18} color={statusColor(item.status)} />
                  <View style={styles.itemBody}>
                    <Text style={type.label} numberOfLines={1}>
                      {typeLabel(item.type, c)}
                    </Text>
                    {item.subject ? (
                      <Text style={styles.subject} numberOfLines={2}>
                        {item.subject}
                      </Text>
                    ) : null}
                    <Text style={styles.meta}>
                      {dateLabel(item.createdAt, locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {statusLabel(item.status, c)}
                    </Text>
                  </View>
                </Animated.View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const STATUS_ICON: Record<NotificationItem['status'], IconName> = {
  QUEUED: 'time-outline',
  SENT: 'checkmark-circle-outline',
  DELIVERED: 'checkmark-circle-outline',
  FAILED: 'alert-circle-outline',
  SUPPRESSED: 'remove-circle-outline',
};

function statusColor(status: NotificationItem['status']): string {
  if (status === 'FAILED') return colors.danger;
  if (status === 'SENT' || status === 'DELIVERED') return colors.success;
  return colors.text3;
}

function statusLabel(status: NotificationItem['status'], c: CatalogCopy): string {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
      return c.notifications.statusSent;
    case 'FAILED':
      return c.notifications.statusFailed;
    case 'SUPPRESSED':
      return c.notifications.statusSuppressed;
    default:
      return c.notifications.statusQueued;
  }
}

/** Название типа из словаря; неизвестный тип показываем как есть, без падения. */
function typeLabel(kind: string, c: CatalogCopy): string {
  const types = c.notifications.types as Record<string, string>;
  return types[kind] ?? kind;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  content: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  section: { ...type.eyebrow, marginTop: space.lg },
  hint: { ...type.bodySm, color: colors.text2 },
  card: { borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowLabel: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245,241,234,0.06)',
  },
  itemBody: { flex: 1, gap: 2 },
  subject: { ...type.bodySm, color: colors.text2 },
  meta: { fontSize: 12, color: colors.text3 },
});
