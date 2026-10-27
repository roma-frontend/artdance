import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { LandingBody } from '@/components/content/landing-body';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getListYourStudio, type ListYourStudioContent } from '@/lib/content';
import { serverMessageOf } from '@/lib/server-message';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { colors, space, type } from '@/theme';

export default function ListYourStudioScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useCachedState<ListYourStudioContent>('content.list-your-studio', 'public');
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getListYourStudio(locale)
      .then((next) => {
        if (alive) setContent(next);
      })
      .catch((error: unknown) => {
        if (alive) setFailed(serverMessageOf(error) ?? t.catalogError);
      });
    return () => {
      alive = false;
    };
  }, [locale, t.catalogError]);

  if (content === null && failed === null) {
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
        <Text style={type.h2}>{c.footer.listStudio}</Text>
      </Animated.View>

      {content === null ? (
        <EmptyState icon="alert-circle-outline" title={failed ?? t.catalogError} />
      ) : (
        <LandingBody content={content} locale={locale} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
});
