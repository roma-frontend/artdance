import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { CheckInError, checkInPass, extractToken, peekPass, type PassPeek } from '@/lib/check-in';
import { useEntitlements } from '@/lib/entitlements';
import { dateLabel } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import { colors, radius, space, type } from '@/theme';

/** Касса на входе: сканирование QR-пропуска или вставка токена. Раздел выключен тумблером `events`. */
export default function StudioCheckInScreen() {
  const entitlements = useEntitlements();
  if (entitlements === null) return null;
  if (entitlements.events !== true) return <Redirect href="/studio" />;
  return <CheckInContent />;
}

function CheckInContent() {
  const locale = deviceLocale(undefined);
  const f = catalogFor(locale).footer;
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [raw, setRaw] = useState('');
  const [peek, setPeek] = useState<PassPeek | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);

  function messageFor(e: unknown): string {
    if (e instanceof CheckInError) {
      if (e.reason === 'ALREADY_CHECKED_IN') return f.checkInAlreadyCheckedIn;
      if (e.status === 400 || e.status === 404 || e.status === 410) return f.checkInInvalidToken;
      return f.checkInFailed;
    }
    return f.checkInNetworkError;
  }

  async function onVerify(source: string) {
    setCheckedIn(false);
    setPeek(null);
    setError(null);
    const token = extractToken(source);
    if (!token) {
      setError(f.checkInEnterToken);
      return;
    }
    setBusy(true);
    try {
      setPeek(await peekPass(token));
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCheckIn() {
    const token = extractToken(raw);
    if (!token) {
      setError(f.checkInNoToken);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await checkInPass(token);
      setCheckedIn(true);
      setPeek((prev) => (prev ? { ...prev, alreadyCheckedIn: true } : prev));
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function startScan() {
    setError(null);
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) {
        setError(f.checkInNoCameraAccess);
        return;
      }
    }
    setScanning(true);
  }

  function onScanned({ data }: { data: string }) {
    if (!scanning) return;
    setScanning(false);
    setRaw(data);
    void onVerify(data);
  }

  function clear() {
    setRaw('');
    setPeek(null);
    setError(null);
    setCheckedIn(false);
  }

  const b = peek?.booking ?? null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack('/studio')} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.headerTitle]} numberOfLines={1}>
          {f.studioCheckInTitle}
        </Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {scanning ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onScanned}
            />
            <View style={styles.cameraFooter}>
              <Button label={f.checkInStop} onPress={() => setScanning(false)} variant="ghost" />
            </View>
          </View>
        ) : (
          <Button label={f.checkInScanCamera} onPress={() => void startScan()} />
        )}

        <View style={styles.card}>
          <TextInput
            value={raw}
            onChangeText={setRaw}
            placeholder={f.checkInPlaceholder}
            placeholderTextColor={colors.text3}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={styles.input}
            accessibilityLabel={f.checkInPlaceholder}
          />
          <View style={styles.row}>
            <Button label={f.checkInVerify} onPress={() => void onVerify(raw)} busy={busy} />
            <Button label={f.checkInClear} onPress={clear} variant="ghost" />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {b ? (
          <View style={styles.card}>
            <Text style={type.h3}>{b.reference}</Text>
            <Text style={type.bodySm}>
              {f.checkInCustomer}: {b.customerName ?? b.customerEmail ?? '—'}
            </Text>
            <Text style={type.bodySm}>
              {f.checkInStarts}: {dateLabel(b.startsAt, locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={type.bodySm}>
              {f.checkInEnds}: {dateLabel(b.endsAt, locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
            {b.venueName ? (
              <Text style={type.bodySm}>
                {f.checkInVenue}: {b.venueName}
              </Text>
            ) : null}
            {b.instructorName ? (
              <Text style={type.bodySm}>
                {f.checkInInstructor}: {b.instructorName}
              </Text>
            ) : null}
            {b.dancerProfile?.level ? <Text style={type.bodySm}>{b.dancerProfile.level}</Text> : null}
            {b.dancerProfile?.note ? <Text style={type.bodySm}>{b.dancerProfile.note}</Text> : null}

            {checkedIn || peek?.alreadyCheckedIn ? (
              <Text style={styles.ok}>
                {checkedIn ? f.checkInDone : f.checkInAlreadyCheckedIn}
                {b.checkInAt ? ` · ${f.checkInCheckedInAt}: ${dateLabel(b.checkInAt, locale, { hour: '2-digit', minute: '2-digit' })}` : ''}
              </Text>
            ) : (
              <Button label={f.checkInMarkAttendance} onPress={() => void onCheckIn()} busy={busy} />
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  headerTitle: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  cameraWrap: { height: 280, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
  cameraFooter: { position: 'absolute', bottom: space.md, left: space.md, right: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  input: { minHeight: 64, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: 'rgba(245,241,234,0.12)', borderRadius: radius.sm, padding: space.md },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  error: { color: colors.accentBright, fontSize: 14, fontWeight: '700' },
  ok: { color: colors.metal, fontSize: 14, fontWeight: '700' },
});
