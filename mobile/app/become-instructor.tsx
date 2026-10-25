import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { LandingBody } from '@/components/content/landing-body';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getBecomeInstructor, type BecomeInstructorContent } from '@/lib/content';
import { serverMessageOf } from '@/lib/server-message';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { colors, space, type } from '@/theme';

export default function BecomeInstructorScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<BecomeInstructorContent | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getBecomeInstructor(locale)
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
        <Text style={type.h2}>{c.footer.becomeInstructor}</Text>
      </Animated.View>

      {content === null ? (
        <EmptyState icon="alert-circle-outline" title={failed ?? t.catalogError} />
      ) : (
        <>
          <View style={styles.body}>
            <LandingBody content={content} locale={locale} />
          </View>
          <View style={[styles.cta, { paddingBottom: insets.bottom + space.lg }]}>
            <Button
              label={c.instructorApply.cta}
              icon="arrow-forward"
              onPress={() => router.push('/become-instructor/apply')}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { flex: 1 },
  cta: { paddingHorizontal: space.xl, paddingTop: space.md },
});
