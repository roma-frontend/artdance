import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { AvatarCropRect, PickedImage } from '@/lib/account-profile';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors, radius, space, type } from '@/theme';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type Size = { width: number; height: number };

type Props = {
  image: PickedImage | null;
  busy?: boolean;
  notice?: string | null;
  onCancel: () => void;
  onConfirm: (crop: AvatarCropRect) => void;
};

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/**
 * Геометрия изображения в квадратной рамке. Фото покрывает рамку целиком
 * (cover), zoom увеличивает его поверх. Совпадает с расчётом серверного кропа.
 */
function geometryFor(size: Size, frame: number, zoom: number) {
  'worklet';
  const scale = Math.max(frame / size.width, frame / size.height) * zoom;
  const dw = size.width * scale;
  const dh = size.height * scale;
  return { scale, dw, dh, maxX: Math.max(0, (dw - frame) / 2), maxY: Math.max(0, (dh - frame) / 2) };
}

/** Модалка кадрирования аватара: перетаскивание и щипок на UI-потоке, кнопки масштаба. */
export function AvatarCropModal({ image, busy = false, notice, onCancel, onConfirm }: Props) {
  const t = messagesFor(deviceLocale(undefined));
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Рамка ограничена и шириной, и высотой: на низком экране и крупном шрифте кнопки остаются видны.
  const frame = Math.max(160, Math.min(screenWidth - space.xl * 2, screenHeight * 0.42, 320));

  const [size, setSize] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoomLabel, setZoomLabel] = useState(MIN_ZOOM);

  const zoom = useSharedValue(MIN_ZOOM);
  const startZoom = useSharedValue(MIN_ZOOM);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (!image) return;
    let alive = true;
    setSize(null);
    setFailed(false);
    setZoomLabel(MIN_ZOOM);
    zoom.value = MIN_ZOOM;
    panX.value = 0;
    panY.value = 0;
    Image.getSize(image.uri)
      .then(({ width, height }) => {
        if (alive) setSize({ width, height });
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [image, panX, panY, zoom]);

  const base = size ? geometryFor(size, frame, MIN_ZOOM) : null;

  // Масштаб и сдвиг ограничены так, чтобы рамка всегда была закрыта фото.
  const clampPan = () => {
    'worklet';
    if (!size) return;
    const g = geometryFor(size, frame, zoom.value);
    panX.value = clamp(panX.value, -g.maxX, g.maxX);
    panY.value = clamp(panY.value, -g.maxY, g.maxY);
  };

  const pinch = usePinchGesture({
    enabled: size !== null && !busy,
    onBegin: () => {
      startZoom.value = zoom.value;
    },
    onUpdate: (event) => {
      zoom.value = clamp(startZoom.value * event.scale, MIN_ZOOM, MAX_ZOOM);
      clampPan();
    },
    onDeactivate: () => {
      scheduleOnRN(setZoomLabel, zoom.value);
    },
  });

  const pan = usePanGesture({
    enabled: size !== null && !busy,
    onBegin: () => {
      startX.value = panX.value;
      startY.value = panY.value;
    },
    onUpdate: (event) => {
      panX.value = startX.value + event.translationX;
      panY.value = startY.value + event.translationY;
      clampPan();
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: zoom.value }],
  }));

  function changeZoom(delta: number) {
    if (!size) return;
    const next = clamp(zoom.value + delta, MIN_ZOOM, MAX_ZOOM);
    const g = geometryFor(size, frame, next);
    zoom.value = withTiming(next, { duration: 180 });
    panX.value = withTiming(clamp(panX.value, -g.maxX, g.maxX), { duration: 180 });
    panY.value = withTiming(clamp(panY.value, -g.maxY, g.maxY), { duration: 180 });
    setZoomLabel(next);
  }

  /** Квадрат кадрирования в долях исходного изображения, как ждёт сервер. */
  function cropRect(): AvatarCropRect | null {
    if (!size) return null;
    const { scale, dw, dh } = geometryFor(size, frame, zoom.value);
    const left = (frame - dw) / 2 + panX.value;
    const top = (frame - dh) / 2 + panY.value;
    const side = frame / scale;
    const w = clamp(side / size.width, 0, 1);
    const h = clamp(side / size.height, 0, 1);
    return {
      x: clamp(-left / scale / size.width, 0, 1 - w),
      y: clamp(-top / scale / size.height, 0, 1 - h),
      w,
      h,
    };
  }

  return (
    <Modal visible={image !== null} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      {/* Modal на Android рисуется в отдельном корне: жестам нужен свой GestureHandlerRootView. */}
      <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
        <Text style={type.h2}>{t.profileAvatarCropTitle}</Text>
        <Text style={styles.hint}>{t.profileAvatarCropHint}</Text>

        <GestureDetector gesture={gesture}>
          <View
            style={[styles.frame, { width: frame, height: frame }]}
            accessibilityRole="adjustable"
            accessibilityLabel={t.profileAvatarCropTitle}
          >
            {image && base ? (
              <Animated.View
                style={[
                  { position: 'absolute', width: base.dw, height: base.dh, left: (frame - base.dw) / 2, top: (frame - base.dh) / 2 },
                  imageStyle,
                ]}
              >
                <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            ) : null}
            <View pointerEvents="none" style={styles.outline} />
          </View>
        </GestureDetector>

        {failed ? <Text style={styles.error}>{t.profileAvatarUnreadable}</Text> : null}
        {notice ? <Text style={styles.error}>{notice}</Text> : null}

        <View style={styles.zoomRow}>
          <PressableScale
            onPress={() => changeZoom(-ZOOM_STEP)}
            disabled={busy || zoomLabel <= MIN_ZOOM}
            accessibilityRole="button"
            accessibilityLabel={t.profileAvatarZoomOut}
            style={styles.zoomButton}
          >
            <Ionicons name="remove" size={22} color={colors.text} />
          </PressableScale>
          <Text style={styles.zoomText}>{Math.round(zoomLabel * 100)}%</Text>
          <PressableScale
            onPress={() => changeZoom(ZOOM_STEP)}
            disabled={busy || zoomLabel >= MAX_ZOOM}
            accessibilityRole="button"
            accessibilityLabel={t.profileAvatarZoomIn}
            style={styles.zoomButton}
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </PressableScale>
        </View>

        <View style={styles.actions}>
          <Button
            label={t.profileAvatarSave}
            onPress={() => {
              const crop = cropRect();
              if (crop) onConfirm(crop);
            }}
            busy={busy}
            disabled={!size || busy}
          />
          <PressableScale onPress={onCancel} disabled={busy} accessibilityRole="button" style={styles.cancel}>
            <Text style={styles.cancelText}>{t.accountCancel}</Text>
          </PressableScale>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', paddingHorizontal: space.xl, gap: space.lg },
  hint: { fontSize: 13, color: colors.text3, textAlign: 'center' },
  frame: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(245,241,234,0.5)',
  },
  error: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,241,234,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  zoomText: { minWidth: 56, textAlign: 'center', fontSize: 14, color: colors.text2, fontVariant: ['tabular-nums'] },
  actions: { alignSelf: 'stretch', gap: space.md, marginTop: 'auto' },
  cancel: { alignItems: 'center', paddingVertical: space.md },
  cancelText: { fontSize: 15, color: colors.text2 },
});
