import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { AccountDataError, exportMyData } from '@/lib/account-data';
import { webUrl } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors, radius, space, type } from '@/theme';

export default function MyDataScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const f = c.footer;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function onExport() {
    setBusy(true);
    setFailed(null);
    try {
      const json = await exportMyData();
      await Share.share({ title: 'artdance-export.json', message: json });
    } catch (error) {
      setFailed(error instanceof AccountDataError ? (error.serverMessage ?? t.catalogError) : t.catalogError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.account.nav.data}</Text>
      </View>

      <View style={styles.body}>
        <Text style={type.eyebrow}>{f.privacyTitle}</Text>

        <View style={styles.card}>
          <Text style={type.h3}>{f.exportTitle}</Text>
          <Text style={type.bodySm}>{f.exportHint}</Text>
          <Button label={f.downloadJson} onPress={onExport} busy={busy} disabled={busy} />
          {failed !== null && <Text style={styles.error}>{failed}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={type.h3}>{f.deleteTitle}</Text>
          <Text style={type.bodySm}>{f.deleteHint}</Text>
          <Button
            label={t.openOnWeb}
            variant="ghost"
            onPress={() => Linking.openURL(webUrl(locale, '/account/data')).catch(() => undefined)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  error: { fontSize: 13, color: colors.accentBright },
});
