import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';
import { colors, space } from '@/theme';
import { ZoomableImage } from './zoomable-image';

type Props = {
  uris: readonly string[];
  /** Индекс открытого кадра; null — просмотр закрыт. */
  index: number | null;
  onClose: () => void;
};

/** Полноэкранный просмотр фото: листание, щипок, двойной тап, свайп вниз закрывает. */
export function ImageViewer({ uris, index, onClose }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index ?? 0);
  const [zoomed, setZoomed] = useState(false);
  const close = useCallback(() => {
    setZoomed(false);
    onClose();
  }, [onClose]);
  const closeLabel = catalogFor(deviceLocale(undefined)).common.actions.close;

  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent onShow={() => setCurrent(index ?? 0)}>
      {/* Modal на Android рисуется в отдельном корне: жестам нужен свой GestureHandlerRootView. */}
      <GestureHandlerRootView style={styles.root}>
        <StatusBar barStyle="light-content" />
        <FlatList
          data={uris}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(uri, i) => `${i}:${uri}`}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => <ZoomableImage uri={item} onZoomChange={setZoomed} onDismiss={close} />}
        />
        <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
          {uris.length > 1 ? (
            <Text style={styles.counter} accessibilityLiveRegion="polite">
              {current + 1} / {uris.length}
            </Text>
          ) : (
            <View />
          )}
          <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel={closeLabel}>
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  counter: { color: colors.white, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
