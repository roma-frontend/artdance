import { FlatList, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { TopTenCard, topTenNumeralSpace } from '@/components/ui/top-ten-card';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/types';
import type { InstructorCard } from '@/lib/catalog';
import { cardView } from '@/lib/catalog-view';
import { useSnapTick } from '@/lib/use-snap-tick';
import { space } from '@/theme';

/** Постер «Топ-10» без цифры. */
const CARD_WIDTH = 124;

/**
 * «Топ-10»: инструкторы по рейтингу, крупная цифра слева от постера, щелчок на каждой карточке.
 * Цифры разной ширины, поэтому снап идёт по рассчитанным смещениям, а не по одному шагу.
 */
export function TopTenRail(props: {
  items: InstructorCard[];
  t: Messages;
  locale: Locale;
  onOpen: (slug: string) => void;
  onLongPress?: (item: InstructorCard) => void;
}) {
  const offsets = props.items.map((_, index) =>
    props.items.slice(0, index).reduce((sum, __, i) => sum + CARD_WIDTH + topTenNumeralSpace(i + 1) + space.md, 0),
  );
  const tick = useSnapTick(CARD_WIDTH + topTenNumeralSpace(1) + space.md);

  return (
    <FlatList
      horizontal
      data={props.items}
      keyExtractor={(item) => item.slug}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      snapToOffsets={offsets}
      decelerationRate="fast"
      onScroll={tick}
      scrollEventThrottle={32}
      renderItem={({ item, index }) => {
        const view = cardView(item, props.t, props.locale);
        return (
          <Animated.View entering={FadeInDown.delay(index * 50).duration(450)}>
            <TopTenCard
              rank={index + 1}
              width={CARD_WIDTH}
              uri={view.uri}
              title={view.title}
              meta={view.meta}
              rating={view.rating}
              onPress={() => props.onOpen(item.slug)}
              onLongPress={props.onLongPress ? () => props.onLongPress?.(item) : undefined}
            />
          </Animated.View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.xl, gap: space.md },
});
