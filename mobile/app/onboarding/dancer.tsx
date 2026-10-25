import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DancerTour } from '@/components/onboarding/dancer-tour';
import { EmptyState } from '@/components/ui/empty-state';
import { catalogFor } from '@/i18n/catalog';
import { loadDancerProfile, type DancerProfile } from '@/lib/dancer-profile';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { serverMessageOf } from '@/lib/server-message';
import { colors, space, type } from '@/theme';

/**
 * Первый тур анкеты танцора. Если анкета уже пройдена, сразу возвращаем в кабинет,
 * как это делает веб на `/onboarding/dancer`.
 */
export default function DancerOnboardingScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<DancerProfile | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadDancerProfile()
      .then((next) => {
        if (!active) return;
        if (next?.onboardingCompleted) router.replace('/(tabs)/account');
        else setProfile(next);
      })
      .catch((error: unknown) => {
        if (active) setFailed(serverMessageOf(error) ?? t.catalogError);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <Text style={type.eyebrow}>{c.onboarding.dancer.eyebrow}</Text>
      </Animated.View>

      {failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : profile === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : (
        <DancerTour
          mode="onboarding"
          initial={profile}
          onDone={() => router.replace('/(tabs)/account')}
          onLater={() => router.replace('/(tabs)')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: space.xl, paddingVertical: space.lg },
});
