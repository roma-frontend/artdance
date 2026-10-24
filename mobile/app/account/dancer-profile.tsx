import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DancerTour } from '@/components/onboarding/dancer-tour';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { loadDancerProfile, type DancerProfile } from '@/lib/dancer-profile';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { serverMessageOf } from '@/lib/server-message';
import { colors, space, type } from '@/theme';

/** Правка анкеты танцора из кабинета. После сохранения возвращаемся назад. */
export default function DancerProfileScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const d = c.onboarding.dancer;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<DancerProfile | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadDancerProfile()
      .then((next) => {
        if (active) setProfile(next);
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
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <View style={styles.titleBlock}>
          <Text style={type.eyebrow}>{d.eyebrow}</Text>
          <Text style={type.h2}>{d.edit.title}</Text>
        </View>
      </Animated.View>

      {failed !== null ? (
        <EmptyState icon="alert-circle-outline" title={failed} />
      ) : profile === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : (
        <DancerTour mode="edit" initial={profile} onDone={() => router.back()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  titleBlock: { flex: 1, gap: space.xs },
});
