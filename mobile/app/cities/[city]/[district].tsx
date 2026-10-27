import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ListSkeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MediaCard } from '@/components/ui/media-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SectionHeader } from '@/components/ui/section-header';
import { catalogFor } from '@/i18n/catalog';
import { listCatalog, type CatalogItem, type Section } from '@/lib/catalog';
import { cardView } from '@/lib/catalog-view';
import { slugTitle } from '@/lib/cities';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterCard3D } from '@/lib/motion';
import { useCities } from '@/lib/use-cities';
import { colors, space, type } from '@/theme';

type Listings = { studios: CatalogItem[]; classes: CatalogItem[] };

/** Район: студии и занятия в нём. Фильтр `district` сервер сравнивает с районом студии («Kentron»). */
export default function DistrictScreen() {
  const { city: citySlug, district: districtSlug } = useLocalSearchParams<{ city: string; district: string }>();
  const locale = deviceLocale(undefined);
  const t = catalogFor(locale);
  const m = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - space.xl * 2 - space.md) / 2);
  const { state, reload } = useCities();
  const [listings, setListings] = useCachedState<Listings>(`content.district.${citySlug}.${districtSlug}`, 'public');
  const [listingsFailed, setListingsFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const city = state.status === 'ready' ? state.cities.find((c) => c.slug === citySlug) : undefined;
  const district = city?.districts?.find((d) => d.slug === districtSlug);
  const missing = state.status === 'ready' && !district;
  const districtName = district ? slugTitle(district.slug) : null;

  useEffect(() => {
    if (!districtName) return;
    let alive = true;
    setListings(null);
    setListingsFailed(false);
    const query = { district: districtName, pageSize: '10' };
    Promise.all([listCatalog('studios', query), listCatalog('classes', query)])
      .then(([studios, classes]) => {
        if (alive) setListings({ studios: studios.items, classes: classes.items });
      })
      .catch(() => {
        if (alive) setListingsFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [districtName, retryKey]);

  const open = (section: Section, slug: string) => router.push({ pathname: '/catalog/[section]/[slug]', params: { section, slug } });

  function grid(section: Section, items: CatalogItem[]) {
    return (
      <View style={screenStyles.grid}>
        {items.map((item, index) => {
          const view = cardView(item, t, locale);
          return (
            <Animated.View key={item.slug} entering={enterCard3D(index)}>
              <MediaCard
                width={cardWidth}
                uri={view.uri}
                title={view.title}
                meta={view.meta}
                badge={view.badge}
                price={view.price}
                rating={view.rating}
                onPress={() => open(section, item.slug)}
              />
            </Animated.View>
          );
        })}
      </View>
    );
  }

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
          <Text style={[type.h1, screenStyles.title]}>{districtName}</Text>
        </Animated.View>
      ) : null}

      {city && district ? (
        listingsFailed ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={m.catalogError}
            actionLabel={t.common.actions.retry}
            onAction={() => setRetryKey((k) => k + 1)}
          />
        ) : listings === null ? (
          <View style={screenStyles.section}>
            <ListSkeleton />
          </View>
        ) : listings.studios.length === 0 && listings.classes.length === 0 ? (
          <View style={screenStyles.section}>
            <Text style={[type.bodySm, screenStyles.hint]}>{t.footer.districtHint}</Text>
            <Button label={t.nav.classes} icon="musical-notes-outline" variant="ghost" onPress={() => router.navigate('/classes')} />
          </View>
        ) : (
          <>
            {listings.studios.length > 0 ? (
              <View style={screenStyles.block}>
                <SectionHeader eyebrow={districtName ?? ''} title={t.nav.studios} />
                {grid('studios', listings.studios)}
              </View>
            ) : null}
            {listings.classes.length > 0 ? (
              <View style={screenStyles.block}>
                <SectionHeader eyebrow={districtName ?? ''} title={t.nav.classes} />
                {grid('classes', listings.classes)}
              </View>
            ) : null}
          </>
        )
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
  section: { paddingHorizontal: space.xl, gap: space.lg, marginTop: space.lg },
  block: { marginTop: space.xxxl, gap: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.xl },
});
