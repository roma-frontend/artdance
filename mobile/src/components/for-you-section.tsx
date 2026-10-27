import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { MediaCard } from '@/components/ui/media-card';
import { SectionHeader } from '@/components/ui/section-header';
import { catalogFor } from '@/i18n/catalog';
import type { Locale } from '@/i18n/config';
import { listCatalog, type ClassCard } from '@/lib/catalog';
import { cardView } from '@/lib/catalog-view';
import { loadDancerProfile, type DancerProfile } from '@/lib/dancer-profile';
import { rankForYou } from '@/lib/for-you';
import { space } from '@/theme';

type Copy = { eyebrow: string; title: string; partner: string };

const COPY: Record<string, Copy> = {
  ru: { eyebrow: 'Персонально', title: 'Для тебя', partner: 'Подобрать партнёра' },
  en: { eyebrow: 'Personal', title: 'For you', partner: 'Find a dance partner' },
  hy: { eyebrow: 'Անձնական', title: 'Քեզ համար', partner: 'Գտնել պարային զուգընկեր' },
};

const CARD_WIDTH = 160;

type Props = {
  locale: Locale;
  onOpen: (slug: string) => void;
  /** Передаётся только когда открыт доступ к подбору партнёра. */
  onDancePartner?: () => void;
};

/**
 * Персональная подборка по анкете танцора. Скрыта для гостей и для тех, кто не прошёл анкету:
 * без данных о вкусах показывать «для тебя» нечестно.
 */
export function ForYouSection({ locale, onOpen, onDancePartner }: Props) {
  const t = catalogFor(locale);
  const copy = COPY[locale] ?? COPY.en;
  const [cards, setCards] = useState<ClassCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let profile: DancerProfile | null;
      try {
        profile = await loadDancerProfile();
      } catch {
        // Без токена или при сбое сети подборку просто не показываем.
        return;
      }
      if (!alive || !profile?.onboardingCompleted) return;

      const styles = profile.styles.slice(0, 3);
      const requests = styles.length > 0 ? styles.map((style) => listCatalog('classes', { style, pageSize: '6' })) : [listCatalog('classes', { pageSize: '12' })];
      const pages = await Promise.all(requests.map((request) => request.catch(() => null)));
      if (!alive) return;

      const pool = pages.flatMap((page) => (page ? (page.items as ClassCard[]) : []));
      setCards(rankForYou(pool, profile));
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (cards === null || cards.length === 0) return null;

  return (
    <View style={styles.block}>
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} />
      <FlatList
        horizontal
        data={cards}
        keyExtractor={(item) => item.slug}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + space.md}
        renderItem={({ item, index }) => {
          const view = cardView(item, t, locale);
          return (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(450)}>
              <MediaCard
                width={CARD_WIDTH}
                uri={view.uri}
                title={view.title}
                meta={view.meta}
                badge={view.badge}
                price={view.price}
                onPress={() => onOpen(item.slug)}
              />
            </Animated.View>
          );
        }}
      />
      {onDancePartner ? (
        <View style={styles.action}>
          <Button label={copy.partner} variant="ghost" onPress={onDancePartner} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 40, gap: space.lg },
  row: { paddingHorizontal: space.xl, gap: space.md },
  action: { paddingHorizontal: space.xl },
});
