import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ListSkeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { slugTitle } from '@/lib/cities';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { useCities } from '@/lib/use-cities';
import { colors, space, type } from '@/theme';

/** Район: заголовок и заглушка, как на веб-странице `/cities/[city]/[district]`. */
export default function DistrictScreen() {
  const { city: citySlug, district: districtSlug } = useLocalSearchParams<{ city: string; district: string }>();
  const locale = deviceLocale(undefined);
  const t = catalogFor(locale);
  const m = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, reload } = useCities();

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const city = state.status === 'ready' ? state.cities.find((c) => c.slug === citySlug) : undefined;
  const district = city?.districts?.find((d) => d.slug === districtSlug);
  const missing = state.status === 'ready' && !district;

  return (
    <ScrollView
      style={screenStyles.screen}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(420)} style={screenStyles.header}>
        <PressableScale onPress={back} accessibilityRole="button" accessibilityLabel={t.common.actions.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
      </Animated.View>

      {state.status === 'loading' ? (
        <View style={screenStyles.section}>
          <ListSkeleton />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <EmptyState
          icon="alert-circle-outline"
          title={m.catalogError}
          actionLabel={t.common.actions.retry}
          onAction={reload}
        />
      ) : null}

      {missing ? (
        <EmptyState icon="compass-outline" title={m.catalogNotFound} actionLabel={m.catalogBack} onAction={back} />
      ) : null}

      {city && district ? (
        <Animated.View entering={FadeInDown.duration(420)} style={screenStyles.intro}>
          <Text style={type.eyebrow}>{slugTitle(city.slug)}</Text>
          <Text style={[type.h1, screenStyles.title]}>{slugTitle(district.slug)}</Text>
          <Text style={[type.bodySm, screenStyles.hint]}>{t.footer.districtHint}</Text>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.md },
  intro: { paddingHorizontal: space.xl, gap: space.xs },
  title: { marginTop: space.xs },
  hint: { color: colors.text2, marginTop: space.sm },
  section: { paddingHorizontal: space.xl },
});
