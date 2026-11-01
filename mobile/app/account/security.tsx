import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { generateBackupCodes, listDeviceSessions, signOutOtherDevices, WrongPasswordError, type DeviceSession } from '@/lib/account-security';
import { dateLabel } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import { serverMessageOf } from '@/lib/server-message';
import { getSessionToken } from '@/lib/session';
import { colors, radius, space, type } from '@/theme';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };

/** Безопасность: устройства с открытой сессией, выход с остальных и резервные коды. */
export default function AccountSecurityScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const s = c.account.security;
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutNotice, setSignOutNotice] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [generating, setGenerating] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codesError, setCodesError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, token] = await Promise.all([listDeviceSessions(), getSessionToken()]);
      setSessions(list);
      setCurrentToken(token);
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

  async function signOutOthers() {
    setSigningOut(true);
    setSignOutNotice(null);
    try {
      await signOutOtherDevices();
      setSignOutNotice(s.signOutOthersDone);
      await load();
    } catch (error) {
      setSignOutNotice(serverMessageOf(error) ?? c.errors.generic.description);
    } finally {
      setSigningOut(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setCodesError(null);
    try {
      setCodes(await generateBackupCodes(password));
      setPassword('');
    } catch (error) {
      setCodes(null);
      setCodesError(error instanceof WrongPasswordError ? s.backupWrongPassword : serverMessageOf(error) ?? c.errors.generic.description);
    } finally {
      setGenerating(false);
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
          <Text style={type.bodySm}>{s.hint}</Text>

          <View style={styles.card}>
            <Text style={type.h3}>{s.sessionsTitle}</Text>
            {sessions.map((session) => {
              const current = session.token === currentToken;
              return (
                <View key={session.id} style={styles.session}>
                  <View style={styles.rowBetween}>
                    <Text style={[type.label, styles.grow]} numberOfLines={2}>
                      {session.userAgent ?? s.sessionUnknown}
                    </Text>
                    {current ? <Text style={styles.badge}>{s.sessionCurrent}</Text> : null}
                  </View>
                  <Text style={type.bodySm}>{s.sessionStarted.replace('{date}', dateLabel(session.createdAt, locale, DATE_OPTIONS))}</Text>
                </View>
              );
            })}
            <View style={styles.row}>
              <Button label={s.signOutOthers} variant="ghost" onPress={() => void signOutOthers()} busy={signingOut} disabled={signingOut} />
            </View>
            {signOutNotice ? <Text style={styles.notice}>{signOutNotice}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={type.h3}>{s.backupTitle}</Text>
            <Text style={type.bodySm}>{s.backupHint}</Text>
            <Text style={type.label}>{s.backupPassword}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel={s.backupPassword}
              style={styles.input}
            />
            <View style={styles.row}>
              <Button label={s.backupGenerate} onPress={() => void generate()} busy={generating} disabled={generating || password.length === 0} />
            </View>
            {codesError ? <Text style={[styles.notice, { color: colors.danger }]}>{codesError}</Text> : null}
            {codes ? (
              <View style={styles.codes}>
                <Text style={type.label}>{s.backupSaveNotice}</Text>
                {codes.map((code) => (
                  <Text key={code} style={styles.code} selectable>
                    {code}
                  </Text>
                ))}
              </View>
            ) : null}
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
  session: { gap: 2, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  badge: { fontSize: 11, color: colors.accentBright, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  input: { height: 44, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: 'rgba(245,241,234,0.12)', borderRadius: radius.sm, paddingHorizontal: space.md },
  codes: { gap: 6, marginTop: space.sm },
  code: { fontFamily: 'monospace', fontSize: 15, color: colors.text },
  notice: { fontSize: 13, color: colors.success },
});
