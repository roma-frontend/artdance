import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { coordsLabel, slugTitle } from '@/lib/cities';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { useCities } from '@/lib/use-cities';
import { colors, radius, space, type } from '@/theme';

/** Город: координаты и список районов, как на веб-странице `/cities/[city]`. */
export default function CityScreen() {
  const { city: citySlug } = useLocalSearchParams<{ city: string }>();
  const locale = deviceLocale(undefined);
  const t = catalogFor(locale);
  const m = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, reload } = useCities();

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openDistrict = (district: string) =>
    router.push({ pathname: '/cities/[city]/[district]', params: { city: citySlug, district } });

  const city = state.status === 'ready' ? state.cities.find((c) => c.slug === citySlug) : undefined;
  const missing = state.status === 'ready' && !city;

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

      {city ? (
        <>
          <View style={screenStyles.intro}>
            <Text style={type.eyebrow}>{t.footer.citiesTitle}</Text>
            <Text style={[type.h1, screenStyles.title]}>{slugTitle(city.slug)}</Text>
            <Text style={[type.bodySm, screenStyles.meta]}>
              {t.footer.cityCoordinates.replace('{coords}', coordsLabel(city.center))}
              {city.districts?.length
                ? ` ${t.footer.cityDistricts.replace('{count}', String(city.districts.length))}`
                : ''}
            </Text>
          </View>

          {city.districts?.length ? (
            <View style={screenStyles.section}>
              <View style={screenStyles.list}>
                {city.districts.map((district, index) => (
                  <Animated.View key={district.slug} entering={FadeInDown.delay(index * 50).duration(380)}>
                    <PressableScale
                      onPress={() => openDistrict(district.slug)}
                      accessibilityRole="button"
                      accessibilityLabel={slugTitle(district.slug)}
                      style={screenStyles.row}
                    >
                      <Text style={[type.title, screenStyles.rowTitle]}>{slugTitle(district.slug)}</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.md },
  intro: { paddingHorizontal: space.xl, gap: space.xs, marginBottom: space.xl },
  title: { marginTop: space.xs },
  meta: { color: colors.text2 },
  section: { paddingHorizontal: space.xl },
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  rowTitle: { flex: 1 },
});
