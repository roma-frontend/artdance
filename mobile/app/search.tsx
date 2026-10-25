import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PosterRowSkeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { MediaCard } from '@/components/ui/media-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { mediaUri } from '@/lib/catalog';
import { useEntitlements } from '@/lib/entitlements';
import { price } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import {
  countHits,
  hitTarget,
  parseSearchScope,
  searchCatalog,
  SEARCH_MIN_LENGTH,
  visibleSearchScopes,
  type SearchHit,
  type SearchScope,
} from '@/lib/search';
import { colors, radius, space } from '@/theme';

type Labels = ReturnType<typeof catalogFor>['search'];

const DEBOUNCE_MS = 250;

/** Ответ на запрос; устаревший ответ отбрасывается сравнением текста запроса. */
interface Outcome {
  term: string;
  hits: SearchHit[];
  failed: boolean;
}

function scopeLabel(labels: Labels, scope: SearchScope): string {
  switch (scope) {
    case 'all':
      return labels.scopeAll;
    case 'classes':
      return labels.scopeClasses;
    case 'instructors':
      return labels.scopeInstructors;
    case 'studios':
      return labels.scopeStudios;
    case 'events':
      return labels.scopeEvents;
    case 'products':
      return labels.scopeProducts;
  }
}

export default function SearchScreen() {
  const locale = deviceLocale(undefined);
  const t = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const entitlements = useEntitlements();
  const params = useLocalSearchParams<{ q?: string; scope?: string }>();

  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [scope, setScope] = useState<SearchScope>(parseSearchScope(params.scope));
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const term = query.trim();
  const longEnough = term.length >= SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (!longEnough) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCatalog(term, locale, controller.signal)
        // Термин берём из запроса, а не из ответа: сервер обрезает длинный запрос до 120 символов.
        .then((payload) => setOutcome({ term, hits: payload.hits, failed: false }))
        .catch(() => {
          // Отмена — это наш следующий запрос, а не сбой поиска.
          if (controller.signal.aborted) return;
          setOutcome({ term, hits: [], failed: true });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, longEnough, locale]);

  // Ответ относится к текущему запросу только если совпал текст.
  const current = outcome && outcome.term === term ? outcome : null;
  const loading = longEnough && current === null;
  const failed = current?.failed === true;
  const allHits: readonly SearchHit[] = current && !current.failed ? current.hits : [];

  const scopes = visibleSearchScopes(entitlements);
  // Если раздел выключен в поставке, показываем всё, а не пустую вкладку.
  const activeScope: SearchScope = scopes.includes(scope) ? scope : 'all';
  const shown = activeScope === 'all' ? allHits : allHits.filter((hit) => hit.scope === activeScope);
  const cardWidth = Math.floor((width - space.xl * 2 - space.md) / 2);

  const openHit = (hit: SearchHit) => {
    const target = hitTarget(hit);
    if (!target) return;
    Keyboard.dismiss();
    router.push({ pathname: '/catalog/[section]/[slug]', params: { section: target.section, slug: target.slug } });
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <PressableScale onPress={back} accessibilityRole="button" accessibilityLabel={t.common.actions.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <View style={styles.box}>
          <Ionicons name="search" size={19} color={colors.text3} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t.search.heroPlaceholder}
            placeholderTextColor={colors.text3}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            selectionColor={colors.accentBright}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={t.common.actions.clear}>
              <Ionicons name="close-circle" size={18} color={colors.text3} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      {longEnough ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip} contentContainerStyle={styles.chips}>
          {scopes.map((candidate) => {
            const active = candidate === activeScope;
            const label = scopeLabel(t.search, candidate);
            const count = current && !current.failed ? countHits(allHits, candidate) : null;
            return (
              <PressableScale
                key={candidate}
                onPress={() => setScope(candidate)}
                accessibilityRole="button"
                accessibilityLabel={count === null ? label : `${label}, ${count}`}
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {count === null ? label : `${label} ${count}`}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
      >
        {!longEnough ? (
          <EmptyState icon="search-outline" title={t.search.minLength.replace('{min}', String(SEARCH_MIN_LENGTH))} />
        ) : loading ? (
          <PosterRowSkeleton />
        ) : failed ? (
          <EmptyState icon="cloud-offline-outline" title={t.search.failed} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title={t.search.noResults.replace('{query}', term)}
            body={t.search.noResultsHint}
          />
        ) : (
          <View style={styles.grid}>
            {shown.map((hit, index) => (
              <Animated.View
                key={`${hit.scope}-${hit.id}`}
                entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(350)}
              >
                <MediaCard
                  width={cardWidth}
                  uri={hit.image ? mediaUri(hit.image) : undefined}
                  title={hit.title}
                  meta={hit.subtitle || undefined}
                  badge={scopeLabel(t.search, hit.scope)}
                  price={hit.price !== undefined ? price(hit.price, locale) : undefined}
                  onPress={() => openHit(hit)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // Горизонтальный ScrollView иначе растягивается по высоте и съедает место результатов.
  chipStrip: { flexGrow: 0, flexShrink: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.md },
  box: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245,241,234,0.1)',
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  chips: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.sm },
  chip: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245,241,234,0.1)',
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accentBright, backgroundColor: colors.accentSoft },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  chipTextActive: { color: colors.text },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
