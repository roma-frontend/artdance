import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { AccountDataError, exportMyData } from '@/lib/account-data';
import { webUrl } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { shareTextFile } from '@/lib/share-file';
import { EASE_OUT } from '@/lib/motion';
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
      await shareTextFile('artdance-export.json', json, 'application/json');
    } catch (error) {
      setFailed(error instanceof AccountDataError ? (error.serverMessage ?? t.catalogError) : t.catalogError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.account.nav.data}</Text>
      </Animated.View>

      <View style={styles.body}>
        <Text style={type.eyebrow}>{f.privacyTitle}</Text>

        <Animated.View entering={FadeInDown.delay(60).duration(420).easing(EASE_OUT)} style={styles.card}>
          <Text style={type.h3}>{f.exportTitle}</Text>
          <Text style={type.bodySm}>{f.exportHint}</Text>
          <Button label={f.downloadJson} onPress={onExport} busy={busy} disabled={busy} />
          {failed !== null && <Text style={styles.error}>{failed}</Text>}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(420).easing(EASE_OUT)} style={styles.card}>
          <Text style={type.h3}>{f.deleteTitle}</Text>
          <Text style={type.bodySm}>{f.deleteHint}</Text>
          <Button
            label={t.openOnWeb}
            variant="ghost"
            onPress={() => Linking.openURL(webUrl(locale, '/account/data')).catch(() => undefined)}
          />
        </Animated.View>
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
