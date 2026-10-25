import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { colors, space, type } from '@/theme';

/** Города работы с районами, как на веб-странице `/cities`. */
export default function CitiesIndexScreen() {
  const locale = deviceLocale(undefined);
  const t = catalogFor(locale);
  const m = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, reload } = useCities();

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openCity = (city: string) => router.push({ pathname: '/cities/[city]', params: { city } });
  const openDistrict = (city: string, district: string) =>
    router.push({ pathname: '/cities/[city]/[district]', params: { city, district } });

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

      <View style={screenStyles.intro}>
        <Text style={type.h1}>{t.footer.citiesTitle}</Text>
      </View>

      {state.status === 'error' ? (
        <EmptyState
          icon="alert-circle-outline"
          title={m.catalogError}
          actionLabel={t.common.actions.retry}
          onAction={reload}
        />
      ) : null}

      {state.status === 'loading' ? (
        <View style={screenStyles.section}>
          <ListSkeleton />
        </View>
      ) : null}

      {state.status === 'ready'
        ? state.cities.map((city, index) => {
            const name = slugTitle(city.slug);
            const districts = city.districts ?? [];
            return (
              <Animated.View
                key={city.slug}
                entering={FadeInDown.delay(index * 70).duration(420)}
                style={screenStyles.card}
              >
                <PressableScale
                  onPress={() => openCity(city.slug)}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  style={screenStyles.cardHead}
                >
                  <View style={screenStyles.cardBody}>
                    <Text style={type.title}>{name}</Text>
                    <Text style={type.caption}>
                      {coordsLabel(city.center)}
                      {districts.length > 0 ? ` ${t.footer.cityDistricts.replace('{count}', String(districts.length))}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                </PressableScale>

                {districts.length > 0 ? (
                  <View style={screenStyles.chips}>
                    {districts.map((district) => (
                      <PressableScale
                        key={district.slug}
                        onPress={() => openDistrict(city.slug, district.slug)}
                        accessibilityRole="button"
                        accessibilityLabel={slugTitle(district.slug)}
                        style={screenStyles.chip}
                      >
                        <Text style={type.caption}>{slugTitle(district.slug)}</Text>
                      </PressableScale>
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            );
          })
        : null}
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.md },
  intro: { paddingHorizontal: space.xl, marginBottom: space.xl },
  section: { paddingHorizontal: space.xl },
  card: {
    marginHorizontal: space.xl,
    marginBottom: space.md,
    padding: space.lg,
    gap: space.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardBody: { flex: 1, gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
});
